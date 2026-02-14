#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = rootPkg.version;

const packages = ['backend', 'frontend'];

for (const pkg of packages) {
  const pkgPath = resolve(pkg, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkgJson.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`✓ ${pkg}/package.json synced to v${version}`);
}
