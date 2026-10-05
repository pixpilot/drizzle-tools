#!/usr/bin/env node
import process from 'node:process';
import { runCli } from './run-cli';

const NODE_ARGUMENT_COUNT = 2;

runCli(process.argv.slice(NODE_ARGUMENT_COUNT)).catch((error: unknown) => {
  console.error('drizzle-migrations failed.', error);
  process.exitCode = 1;
});
