import { spawnSync } from 'node:child_process';

/**
 * Regenerates the byte-for-byte format fixtures.
 *
 * A script rather than an inline `VAR=x vitest`, because that syntax does not
 * work in cmd.exe and this project's whole point is that it runs on Windows.
 *
 * Regenerating is a deliberate act: the fixtures exist to make a change in the
 * wire format visible, so read the resulting diff before committing it.
 */
const result = spawnSync('npx', ['vitest', 'run', 'test/formats/golden.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_GOLDENS: '1' },
});

process.exit(result.status ?? 1);
