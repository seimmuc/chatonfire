#!/usr/bin/env ts-node

// A build script that triggers tsc and then copies static files that have been modified. Would just use `rsync --update` if Windows shipped with it.

import { exec } from 'node:child_process';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { BUILD_COPY_GLOBS, BUILD_IN_DIR, BUILD_OUT_DIR, copyGlobbedFilesIfDifferent, getFunctionsDirOrExit } from './common.mts';



// Make sure we have a valid directory
const funcDir = await getFunctionsDirOrExit();

// Run tsc
const promisifiedExec = promisify(exec);
const tscPromise = promisifiedExec(`tsc --outDir ${BUILD_OUT_DIR}`);
await new Promise(res => {
  tscPromise.catch(error => {
    if (error.code !== 0) {
      console.error('Typescript compilation failed.');
      console.error(error.stdout);
    } else {
      console.error('Something went wrong');
      throw error;
    }
    process.exit(2);
  }).finally(res as () => void);
});


// Copy static files
await copyGlobbedFilesIfDifferent(resolve(join(funcDir, BUILD_IN_DIR)), resolve(join(funcDir, BUILD_OUT_DIR)), BUILD_COPY_GLOBS);
