#!/usr/bin/env node

// A build script that triggers tsc and then copies static files that have been modified. Would just use `rsync --update` if Windows shipped with it.

import { exec } from 'node:child_process';
import { copyFile, glob, readFile, stat, utimes, constants as fsconstants, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const ROOT_PACKAGE_NAME = 'chatonfire';
const IN_DIR = './src';
const OUT_DIR = './lib';
const COPY_GLOBS = ['views/**/*.ejs', 'public/**/*'];


/**
 * Reads and parses a json file
 * @param {string | import('node:fs/promises').FileHandle} path json file path
 * @returns {Promise<object | array | string | number | boolean | null>} contents of the json file
 */
async function readJson(path) {
  return JSON.parse(await readFile(path, {encoding: 'utf8', flag: 'r'}));
}

/**
 * Verifies that we're in the right directory
 * @returns {Promise<[correct: boolean, error: string?]>} [correct, error] tuple with a confirmation that directory is correct and an error message if it isn't
 */
async function verifyFunctionsDir(funcDir) {
  try {
    const [funcPackage, rootPackage] = await Promise.all([readJson(join(funcDir, './package.json')), readJson(join(funcDir, '../package.json'))]);
    if (typeof funcPackage !== 'object' || funcPackage.name !== 'functions') {
      return [false, 'failed to locate functions package'];
    }
    if (typeof rootPackage !== 'object' || rootPackage.name !== ROOT_PACKAGE_NAME) {
      return [false, `failed to locate root (${ROOT_PACKAGE_NAME}) package`];
    }
    return [true, undefined];
  } catch (err) {
    if (typeof err === 'object' && Object.hasOwn(err, 'message')) {
      err = err.message;
    }
    return [false, err.toString()];
  }
}

/**
 * Creates a new directory if it did not already exist
 * @param {string | import('node:fs/promises').FileHandle} dirPath directory path
 * @returns whether or not a new directory was created
 */
async function mkdirIfMissing(dirPath) {
  try {
    const stats = await stat(dirPath);
    if (stats.isDirectory()) {
      return false;
    } else {
      throw new Error(`${dirPath} already exists, but is not a directory`);
    }
  } catch (err) {
    if (typeof err === 'object' && err.code === 'ENOENT') {
      await mkdir(dirPath, {recursive: true});
      return true;
    }
  }
  return false;
}

/**
 * Copies a file to a given destination path, preserving its modification time. Does nothing if there already is a file at the destination with same size and modification time.
 * @param {string | import('node:fs/promises').FileHandle} sourcePath path to the source file
 * @param {string | import('node:fs/promises').FileHandle} destPath path to the destination file, that may not exist yet
 * @returns {Promise<boolean>} whether or not the file was copied
 */
async function copyFileIfDIfferent(sourcePath, destPath) {
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

// Make sure we have a valid directory
const funcDir = resolve(join(import.meta.dirname, '..'));
const [correctDir, err] = await verifyFunctionsDir(funcDir);
if (!correctDir) {
  console.error('Invalid directory. Project may have been renamed or the build script might have been moved.');
  console.error(err);
  process.exit(1);
}

// Run tsc
const promisifiedExec = promisify(exec);
const tscPromise = promisifiedExec(`tsc --outDir ${OUT_DIR}`);
const tscProcStreams = await tscPromise;
if (tscPromise.child.exitCode !== 0) {
  console.error('Typescript compilation failed.');
  console.error(tscProcStreams.stderr);
  process.exit(2);
}

// Copy files with minimal IO write operations
const inDirAbs = resolve(join(funcDir, IN_DIR));
const outDirAbs = resolve(join(funcDir, OUT_DIR));
/** @type {Promise<boolean>[]} */
const copyJobs = [];
for (const copyGlob of COPY_GLOBS) {
  for await (const de of glob(copyGlob, {cwd: inDirAbs, withFileTypes: true})) {
    // We currently ignore directories and symlinks
    if (de.isFile()) {
      const destPath = resolve(join(outDirAbs, relative(inDirAbs, de.parentPath), de.name));
      const copyPromise = copyFileIfDIfferent(join(de.parentPath, de.name), destPath);
      copyJobs.push(copyPromise);
    }
  }
}
await Promise.all(copyJobs);
