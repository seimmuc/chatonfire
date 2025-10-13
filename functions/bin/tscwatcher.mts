#!/usr/bin/env ts-node

// This code was originally copied from https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#writing-an-incremental-program-watcher

import ts from "typescript";

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine
};


export type TTYActionType = 'write' | 'clear';
export type TTYActionListener = (action: TTYActionType, data?: string) => void;

interface WatchListeners {
  diagnosticReporter?: ts.DiagnosticReporter;
  watchStatusReporter?: ts.WatchStatusReporter;
  ttyAction?: TTYActionListener;
}

export function tscWatchMain(projectPath?: string, listeners?: WatchListeners, prepareProgram?: (wch: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>) => void): ts.WatchOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram> {
  listeners ??= {};

  const configPath = ts.findConfigFile(
    projectPath ?? './',
    ts.sys.fileExists,
    'tsconfig.json'
  );
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  // ts.createSemanticDiagnosticsBuilderProgram
  const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;

  const system = {...ts.sys};
  if (listeners.ttyAction === undefined) {
    system.write = (_s) => {},
    system.clearScreen = () => {}
  } else {
    const ttyAction = listeners.ttyAction;
    system.write = (s) => ttyAction('write', s.trim()),
    system.clearScreen = () => ttyAction('clear')
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {},
    system,
    createProgram,
    listeners.diagnosticReporter,
    listeners.watchStatusReporter
  );

  if (prepareProgram !== undefined) {
    prepareProgram(host);
  }
  return ts.createWatchProgram(host);
}
