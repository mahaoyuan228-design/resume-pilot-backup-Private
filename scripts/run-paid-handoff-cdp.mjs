#!/usr/bin/env node
// Paid Edge handoff QA. Never clicks 保存/提交/Save/Submit.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from './lib/paid-qa-runner.mjs';

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
  main().then((code) => {
    process.exit(code);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { main };
