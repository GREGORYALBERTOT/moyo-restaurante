import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.test-build', { recursive: true });
try {
  const entries=['tests/store.test.ts','tests/api.test.ts'];
  if (process.argv.includes('--integration')) entries.push('tests/database.test.ts');
  await build({ entryPoints: entries, bundle: true, platform: 'node', format: 'esm', packages:'external', outdir: '.test-build', outExtension:{'.js':'.mjs'} });
  const result = spawnSync(process.execPath, ['--test', ...entries.map(file=>'.test-build/'+file.split('/').pop().replace('.ts','.mjs'))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await Promise.all(['store.test','api.test','database.test'].map(name=>rm(`.test-build/${name}.mjs`, {force:true}))); }
