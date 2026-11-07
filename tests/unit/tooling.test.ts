import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Tooling and Build Configuration', () => {
  it('package.json scripts must include server typechecking and JS build', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.scripts.lint).toContain('tsconfig.server.json');
    expect(pkg.scripts.build).toContain('build-server');
    expect(pkg.scripts.start).toMatch(/node\s+dist-server\/server\.js/);
  });

  it('tsconfig.server.json must include server and scripts', () => {
    expect(fs.existsSync('tsconfig.server.json')).toBe(true);
    const tsconfigServer = JSON.parse(fs.readFileSync('tsconfig.server.json', 'utf-8'));
    expect(tsconfigServer.include).toContain('server.ts');
  });

  it('scripts/build-server.mjs must exist and bundle server', () => {
    expect(fs.existsSync('scripts/build-server.mjs')).toBe(true);
    const buildScript = fs.readFileSync('scripts/build-server.mjs', 'utf-8');
    expect(buildScript).toContain('dist-server/server.js');
  });

  it('.gitignore must ignore secrets, uploads and backups', () => {
    expect(fs.existsSync('.gitignore')).toBe(true);
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('dist-server');
    expect(gitignore).toContain('uploads');
  });

  it('.dockerignore must ignore node_modules and .env', () => {
    expect(fs.existsSync('.dockerignore')).toBe(true);
    const dockerignore = fs.readFileSync('.dockerignore', 'utf-8');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.env');
  });
});

