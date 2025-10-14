import { ChildProcess, spawn } from "node:child_process";
import { BUILD_COPY_GLOBS, BUILD_IN_DIR, BUILD_OUT_DIR, copyFileIfDIfferent, copyGlobbedFilesIfDifferent, getFunctionsDirOrExit, matchesBuildGlobs, PrefixLogger, type BuildGlobs, type SimpleLogger } from "./common.mts";
import { parseArgs } from "node:util";
import { type FileChangeInfo, stat, unlink, watch } from "node:fs/promises";
import { join, matchesGlob } from "node:path";
import { tscWatchMain, type TTYActionListener } from "./tscwatcher.mts";
import type { EmitAndSemanticDiagnosticsBuilderProgram, WatchOfConfigFile } from "typescript";


interface BackgroundRunner {
  abortSignal: AbortSignal;
  stop(): Promise<void>;
}

class FirebaseEmulatorRunner implements BackgroundRunner {
  cwdDir: string;
  environment: string;
  logger: SimpleLogger | undefined;
  color: boolean;
  abortSignal: AbortSignal;
  protected cProcess: ChildProcess | undefined = undefined;
  constructor(cwdDir: string, environment: string, abortSignal: AbortSignal, logger?: SimpleLogger, ttyColor=true) {
    this.cwdDir = cwdDir;
    this.environment = environment;
    this.logger = logger;
    this.color = ttyColor;
    this.abortSignal = abortSignal;
  }
  
  public get childProcess() : ChildProcess | undefined {
    return this.cProcess;
  }
  
  async start(): Promise<boolean> {
    if (this.cProcess !== undefined) {
      throw new Error();
    }
    const cProcess = spawn('firebase', ['emulators:start'], {
      cwd: this.cwdDir,
      env: {...process.env, NODE_ENV: this.environment, FORCE_COLOR: this.color ? '1' : '0'},
      signal: this.abortSignal,
      stdio: 'pipe',
      // setting `detached: true` here would prevent the shell from sending SIGINT to the child process when user uses Ctrl+C, but this
      // should not be nessesary. Firebase should still shut down gracefully after recieving both a single SIGINT and a single SIGTERM.
    });
    this.cProcess = cProcess;

    cProcess.on('error', (err) => {
      if (err.name !== 'AbortError') {
        this.logger?.error('child process error: ', err);
      }
    });
    
    // This promise waits for the emulator's ready message on stdout
    const readyPromise: Promise<boolean> = new Promise(resolve => {
      if (cProcess.stdout === null) {
        resolve(false);
      }
      const readyListener = (chunk: any) => {
        if (chunk instanceof Buffer && chunk.includes('All emulators ready! It is now safe to connect your app.')) {
          cProcess.stdout.off('data', readyListener);
          resolve(true);
        }
      }
      cProcess.stdout.on('data', readyListener);
    });

    // Forward stdout and stderr to logger, if present
    if (this.logger) {
      this.cProcess.stdout?.on('data', (chunk) => {
        if (chunk instanceof Buffer) {
          let s = chunk.toString('utf8').trim();
          if (s.includes('\n')) {
            s = '\n' + s;
          }
          this.logger?.log(s);
        }
      });
      this.cProcess.stderr?.on('data', (chunk) => {
        if (chunk instanceof Buffer) {
          let s = chunk.toString('utf8').trim();
          if (s.includes('\n')) {
            s = '\n' + s;
          }
          this.logger?.log(s);
        }
      });
    }

    return readyPromise;
  }
  async stop() {
    const cpr = this.cProcess;
    if (cpr === undefined) {
      return;
    }
    if (cpr.exitCode !== null) {
      // firebase process was already killed
      return;
    }
    const exitPromise: Promise<void> = new Promise(resolve => cpr.once('exit', resolve));
    if (!cpr.killed) {
      // SIGTERM was not sent yet
      cpr.kill();
    }
    return exitPromise;
  }
}

/**
 * Copies modified files over on start, then continies to watch and copy files as they get modified until abortSignal is triggered.
 */
class StaticFileWatchRunner implements BackgroundRunner {
  inDirAbs: string;
  outDirAbs: string;
  copyGlobs: BuildGlobs;
  canDelete: boolean;
  debounceDelay: number;
  runPendingOnAbort: boolean;
  abortSignal: AbortSignal;
  protected runnerPromise: Promise<void> | undefined;
  protected debounceQueue: Record<string, [FileChangeInfo<string>, NodeJS.Timeout]> = {};
  protected handlerPromises: Set<Promise<void>> = new Set();
  constructor(inDirAbs: string, outDirAbs: string, copyGlobs: BuildGlobs, abortSignal: AbortSignal, canDelete=true, debouceDelay=25, runPendingOnAbort=false) {
    this.inDirAbs = inDirAbs;
    this.outDirAbs = outDirAbs;
    this.copyGlobs = copyGlobs;
    this.canDelete = canDelete;
    this.debounceDelay = debouceDelay;
    this.runPendingOnAbort = runPendingOnAbort;
    this.abortSignal = abortSignal;
  }
  public get runPromise() : Promise<void> | undefined {
    return this.runnerPromise;
  }
  /**
   * Start file watcher
   */
  async start(): Promise<void> {
    if (this.runnerPromise !== undefined) {
      throw new Error();
    }
    await copyGlobbedFilesIfDifferent(this.inDirAbs, this.outDirAbs, this.copyGlobs);
    const watcher = watch(this.inDirAbs, {persistent: true, recursive: true, signal: this.abortSignal});
    this.runnerPromise = this.runLoop(watcher);
  }
  /**
   * To actually stop filewatch you must trigger the abortSignal passed to the constructor before/instead of calling this method. This method does
   * not actually do anything besides returning a promise that will resolve once all active operations are finished.
   * @returns a promise that will resolve when watch loop stops and all running IO tasks finish
   */
  async stop(): Promise<void> {
    if (this.runnerPromise === undefined) {
      return;
    }
    if (!this.abortSignal.aborted) {
      throw new Error('abortSignal must be triggered to stop');
    }
    await this.runnerPromise;
    await Promise.allSettled(new Array(this.handlerPromises));
  }
  private async runLoop(watcher: AsyncIterable<FileChangeInfo<string>, any, any>): Promise<void> {
    try {
      for await (const event of watcher) {
        // Check if the glob matches
        if (event.filename === null || !matchesBuildGlobs(event.filename, this.copyGlobs)) {
          continue;
        }
        // debounce repeat events on the same file
        // NOTE: currently debouncing happens based ONLY on the filename! If event.eventType becomes important to handle the event, this must change.
        const dId = event.filename;
        if (dId in this.debounceQueue) {
          // unschedule execution of previous event handler
          clearTimeout(this.debounceQueue[dId][1]);
        }
        // schedule event handler and save its id in debounceQueue
        const timeoutId = setTimeout(() => {
          delete this.debounceQueue[dId];
          const handlePromse = this.handleWatchEvent(event as FileChangeInfo<string> & {filename: string});
          this.handlerPromises.add(handlePromse);
          handlePromse.finally(() => {
            this.handlerPromises.delete(handlePromse);
          });
        }, this.debounceDelay);
        this.debounceQueue[dId] = [event, timeoutId];
      }
    } catch (err) {
      if (err === null || typeof err !== 'object' || !('name' in err)) {
        throw err;
      }
      if (err.name === 'AbortError') {
        if (this.runPendingOnAbort) {
          for (const [event, timeoutId] of Object.values(this.debounceQueue)) {
            clearTimeout(timeoutId);
            const handlePromse = this.handleWatchEvent(event as FileChangeInfo<string> & {filename: string});
            this.handlerPromises.add(handlePromse);
            handlePromse.finally(() => {
              this.handlerPromises.delete(handlePromse);
            });
          }
        }
        return;
      }
      throw err;
    }
  }
  private async handleWatchEvent(event: FileChangeInfo<string> & {filename: string}) {
    const sourcePath = join(this.inDirAbs, event.filename);
    const targetPath = join(this.outDirAbs, event.filename);
    try {
      const sourceStats = await stat(sourcePath);
      if (sourceStats.isFile()) {
        await copyFileIfDIfferent(sourcePath, targetPath);
      }
    } catch (err) {
      if (err !== null && typeof err === 'object' && (
        ('code' in err && err.code === 'ENOENT') ||
        (err !== null && typeof err === 'object' && 'message' in err && err.message === 'source file does not exist')
      )) {
        // source path does not point to anything, try to remove target file
        try {
          const targetStats = await stat(targetPath);
          if (targetStats.isFile()) {
            await unlink(targetPath);
          }
        } catch (err) {
          if (err !== null && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            // target path doesn't point to anything either, do nothing
          } else {
            throw err;
          }
        }
      } else {
        throw err;
      }
    }
  }
}


class TSCWatchRunner implements BackgroundRunner {
  projectDir: string;
  logger: SimpleLogger | undefined;
  abortSignal: AbortSignal;
  protected tscProgram: WatchOfConfigFile<EmitAndSemanticDiagnosticsBuilderProgram> | undefined = undefined;
  constructor(projectDir: string, abortSignal: AbortSignal, logger?: SimpleLogger) {
    this.projectDir = projectDir;
    this.logger = logger;
    this.abortSignal = abortSignal;
  }
  start() {
    if (this.tscProgram !== undefined) {
      throw new Error();
    }
    if (this.abortSignal.aborted) {
      throw new Error('already aborted');
    }
    this.abortSignal.addEventListener('abort', () => this.stop(), { once: true });
    const ttyAction: TTYActionListener | undefined = this.logger === undefined ? undefined : (a, d) => {
      if (a === 'write' && d !== undefined && this.logger !== undefined) {
        this.logger.log(d);
      }
    };
    this.tscProgram = tscWatchMain(this.projectDir, {ttyAction});
  }
  async stop(): Promise<void> {
    if (this.tscProgram === undefined) {
      return;
    }
    this.tscProgram.close();
  }
}


async function main() {
  const {values: args} = parseArgs({strict: true, options: {
    env: {type: 'string', default: 'dev', short: 'e'},
    'no-firebase': {type: 'boolean', default: false}
  }});
  const funcDir = await getFunctionsDirOrExit();
  const logger = new PrefixLogger('\x1b[35m[SW]\x1b[0m', console);  // Magenta: \x1b[35m

  const backgroundRunners: BackgroundRunner[] = [];
  const timers: NodeJS.Timeout[] = [];

  // Init abort process
  const abortController = new AbortController();
  const abortPromise: Promise<Event> = new Promise(resolve => abortController.signal.addEventListener('abort', resolve, { once: true }));
  const cleanupPromise = abortPromise.then(async _event => { 
    timers.forEach(clearTimeout);
    const promises: Promise<void>[] = [];
    for (const runner of backgroundRunners) {
      promises.push(runner.stop());
    }
    const results = await Promise.allSettled(promises);
    for (const [runner, result] of results.map((val, i) => [backgroundRunners[i], val] as [BackgroundRunner, PromiseSettledResult<void>])) {
      const rn = runner.constructor.name;
      if (result.status === 'fulfilled') {
        logger.debug(`runner ${rn} stopped successfully`);
      } else {
        const errName = typeof result.reason === 'object' ? result.reason.name : result.reason.toString();
        logger.debug(`runner ${rn} ran into an issue while stopping: ${errName}`);
      }
    }
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      logger.info(`Received ${signal} signal, shutting down`);
      abortController.abort(signal);
    });
  }

  try {
    const startPromises: Promise<any>[] = [];
    logger.info('starting runners');
    
    // Static file watcher
    const staticRunner = new StaticFileWatchRunner(join(funcDir, BUILD_IN_DIR), join(funcDir, BUILD_OUT_DIR), BUILD_COPY_GLOBS, abortController.signal);
    backgroundRunners.push(staticRunner);
    startPromises.push(staticRunner.start());

    // TSC --watch
    const tscLogger = new PrefixLogger('\x1b[34m[TSC]\x1b[0m', console); // Blue: \x1b[34m
    const tscRunner = new TSCWatchRunner(funcDir, abortController.signal, tscLogger);
    backgroundRunners.push(tscRunner);
    tscRunner.start();  // TSCWatchRunner.start() is not async, this will block this thread for some time

    // Firebase emulator
    if (args['no-firebase'] === false) {
      const fbLogger = new PrefixLogger('\x1b[33m[FB]\x1b[0m', console);  // Yellow: \x1b[33m
      const fbRunner = new FirebaseEmulatorRunner(funcDir, args.env, abortController.signal, fbLogger, true);
      backgroundRunners.push(fbRunner);
      fbRunner.childProcess?.on('exit', (code, signal) => {
        if (!abortController.signal.aborted) {
          logger.error(`Firebase process stopped unexpectedly with (code: ${code}, signal: ${signal})`);
          abortController.abort('firebase_exit');
        }
      })
      startPromises.push(fbRunner.start());
    }

    // wait for async runners to finish, with timeout
    logger.info(`waiting for ${startPromises.length} runners to get ready`);
    const startTimeoutMs = 20_000;
    const timeoutPromise: Promise<never> = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject('start_timeout');
      }, startTimeoutMs);
    });
    Promise.race([Promise.all(startPromises), timeoutPromise]).then(() => {
      logger.info('all runners started, use Ctrl+C to stop');
    }).catch(err => {
      if (err === 'start_timeout') {
        logger.error(`failed to start within ${startTimeoutMs / 1000}s, shutting down`);
        abortController.abort();
      } else {
        throw err;
      }
    });
  } catch (err) {
    abortController.abort(err);
    throw err;
  }
  
  // timers.push(setTimeout(() => {
  //   logger.debug('aborting on timer');
  //   abortController.abort('timer');
  // }, 30_000));

  await cleanupPromise;
  logger.info('shutdown complete');
}

main();
