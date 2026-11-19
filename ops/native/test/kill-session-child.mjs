// Runs a whole native session against a file-backed fake device and is killed while Maestro runs
// (session.test.mjs). Not a test file: it is started by one.
import { writeFileSync } from 'node:fs';
import { runNative } from '../lib/session.mjs';
import { nativeWorld } from './native-world.mjs';

const [deviceFile, outFile] = process.argv.slice(2);
const x = nativeWorld({
  deviceFile,
  maestro: async () => {
    process.kill(process.pid, 'SIGKILL');
    await new Promise((r) => setTimeout(r, 10_000));
  },
});
writeFileSync(outFile, x.dir);
await runNative(x.args());
console.log('KILL-SESSION-SURVIVED');
