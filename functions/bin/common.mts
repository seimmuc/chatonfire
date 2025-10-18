import type { PathLike } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { copyFile, readFile, stat, utimes, constants as fsconstants, mkdir, glob } from 'node:fs/promises';
import { basename, dirname, join, matchesGlob, relative, resolve } from 'node:path';

// Options
const ROOT_PACKAGE_NAME = 'chatonfire';
export const BUILD_IN_DIR = './src';
export const BUILD_OUT_DIR = './lib';
export const BUILD_COPY_GLOBS: BuildGlobs = {include: ['views/**/*.ejs', 'public/**/*'], exclude: ['**/*.ts', '**/*.mts']};


export type BuildGlobs = {include: string[], exclude: string[]};


/**
 * Reads and parses a json file
 * @param {PathLike | import('node:fs/promises').FileHandle} path json file path
 * @returns {Promise<object | array | string | number | boolean | null>} contents of the json file
 */
export async function readJson(path: PathLike | FileHandle): Promise<object | Array<any> | string | number | boolean | null> {
  return JSON.parse(await readFile(path, {encoding: 'utf8', flag: 'r'}));
}

/**
 * * Verifies that the given path points to the project's /funcitons/ directory by finding appropriate package.json files
 * @param {string} funcDir path to the <projectDir>/functions/ directory
 * @returns {Promise<[correct: boolean, error?: string]>} [correct, error] tuple with a confirmation that directory is correct and an error message if it isn't
 */
export async function verifyFunctionsDir(funcDir: string): Promise<[correct: boolean, error?: string]> {
  if (basename(resolve(funcDir)) !== 'functions') {
    return [false, `invalid duncDir path, must point to 'functions' directory`];
  }
  try {
    const [funcPackage, rootPackage] = await Promise.all([readJson(join(funcDir, './package.json')), readJson(join(funcDir, '../package.json'))]);
    if (typeof funcPackage !== 'object' || funcPackage === null || !('name' in funcPackage) || funcPackage.name !== 'functions') {
      return [false, 'failed to locate functions package'];
    }
    if (typeof rootPackage !== 'object' || rootPackage === null || !('name' in rootPackage) || rootPackage.name !== ROOT_PACKAGE_NAME) {
      return [false, `failed to locate root (${ROOT_PACKAGE_NAME}) package`];
    }
    return [true, undefined];
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'message' in err) {
      err = err.message;
    }
    return [false, String(err)];
  }
}

/**
 * Determines path to the project's /funcitons/ directory and verifies it, if verification fails the process is terminated
 * @returns {Promise<string>} absolute path to /funcitons/ directory
 */
export async function getFunctionsDirOrExit() {
  const funcDir = resolve(join(import.meta.dirname, '..'));
  const [correctDir, err] = await verifyFunctionsDir(funcDir);
  if (correctDir) {
    return funcDir;
  }
  console.error('Invalid directory. Project may have been renamed or the script might have been moved.');
  console.error(err);
  process.exit(1);
}

/**
 * Creates a new directory if it did not already exist
 * @param {PathLike} dirPath directory path
 * @returns whether or not a new directory was created
 */
export async function mkdirIfMissing(dirPath: PathLike) {
  try {
    const stats = await stat(dirPath);
    if (stats.isDirectory()) {
      return false;
    } else {
      throw new Error(`${dirPath} already exists, but is not a directory`);
    }
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT') {
      await mkdir(dirPath, {recursive: true});
      return true;
    }
  }
  return false;
}

/**
 * Copies a file to a given destination path, preserving its modification time. Does nothing if there already is a file at the destination with same size and modification time.
 * @param {PathLike} sourcePath path to the source file
 * @param {string} destPath path to the destination file, that may not exist yet
 * @returns {Promise<boolean>} whether or not the file was copied
 */
export async function copyFileIfDIfferent(sourcePath: PathLike, destPath: string): Promise<boolean> {
  const stats = await Promise.allSettled([stat(sourcePath), stat(destPath)]);
  const [sourceStats, destStats] = stats.map(p => {
    if (p.status === 'fulfilled') {
      return p.value;     // Return file stat
    }
    if (typeof p.reason === 'object' && p.reason.code === 'ENOENT') {
      return undefined;   // Missing file
    }
    throw p.reason;       // Rethrow unknown error
  });
  if (sourceStats === undefined) {
    throw new Error('source file does not exist');
  }
  const doCopy = destStats === undefined || sourceStats.size !== destStats.size || sourceStats.mtimeMs !== sourceStats.mtimeMs;
  if (doCopy) {
    await mkdirIfMissing(dirname(destPath));
    await copyFile(sourcePath, destPath, fsconstants.COPYFILE_FICLONE);
    await utimes(destPath, sourceStats.atime, sourceStats.mtime);
    return true;
  }
  return false;
}

/**
 * Copies matching files with minimal IO write operations
 * @param {string} inDirAbs source root directory
 * @param {string} outDirAbs target directory
 * @param {string[]} copyGlobs list of relative glob patterns to match files in the source directory to be copied over
 */
export async function copyGlobbedFilesIfDifferent(inDirAbs: string, outDirAbs: string, copyGlobs: BuildGlobs) {
  const copyJobs: Promise<boolean>[] = [];
  for await (const de of glob(copyGlobs.include, {cwd: inDirAbs, withFileTypes: true, exclude: copyGlobs.exclude})) {
    // We currently ignore directories and symlinks
    if (de.isFile()) {
      const destPath = resolve(join(outDirAbs, relative(inDirAbs, de.parentPath), de.name));
      const copyPromise = copyFileIfDIfferent(join(de.parentPath, de.name), destPath);
      copyJobs.push(copyPromise);
    }
  }
  await Promise.all(copyJobs);
}

export function matchesBuildGlobs(testPath: string, buildGlobs: BuildGlobs) {
  return buildGlobs.include.some(glob => matchesGlob(testPath, glob)) && !buildGlobs.exclude.some(glob => matchesGlob(testPath, glob));
}

export type SimpleLogger = Pick<Console, 'log' | 'debug' | 'info' | 'warn' | 'error'>
export class PrefixLogger implements SimpleLogger{
  prefix;
  parent;
  constructor(prefix: string, parent: SimpleLogger) {
    this.prefix = prefix;
    this.parent = parent;
  }
  log(message?: any, ...optionalParams: any[]): void {
    this.parent.log(this.prefix, message, ...optionalParams);
  }
  debug(message?: any, ...optionalParams: any[]): void {
    this.parent.debug(this.prefix, message, ...optionalParams);
  }
  info(message?: any, ...optionalParams: any[]): void {
    this.parent.info(this.prefix, message, ...optionalParams);
  }
  warn(message?: any, ...optionalParams: any[]): void {
    this.parent.warn(this.prefix, message, ...optionalParams);
  }
  error(message?: any, ...optionalParams: any[]): void {
    this.parent.error(this.prefix, message, ...optionalParams);
  }
}
