import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

// Ensure dist-server directory exists
if (!fs.existsSync('dist-server')) {
  fs.mkdirSync('dist-server', { recursive: true });
}

// Build server entry point
await esbuild.build({
  entryPoints: ['server.ts'],
  outfile: 'dist-server/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: !isProduction,
  logLevel: 'info',
});

// Optionally build worker/cli scripts if they exist
const extraEntries = [
  { in: 'server/worker.ts', out: 'dist-server/server/worker.js' },
  { in: 'scripts/db-migrate.ts', out: 'dist-server/scripts/db-migrate.js' },
  { in: 'scripts/bootstrap-admin.ts', out: 'dist-server/scripts/bootstrap-admin.js' },
  { in: 'scripts/migrate-json-to-pg.ts', out: 'dist-server/scripts/migrate-json-to-pg.js' },
];

for (const entry of extraEntries) {
  if (fs.existsSync(entry.in)) {
    const outDir = path.dirname(entry.out);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    await esbuild.build({
      entryPoints: [entry.in],
      outfile: entry.out,
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      packages: 'external',
      sourcemap: !isProduction,
      logLevel: 'info',
    });
  }
}

