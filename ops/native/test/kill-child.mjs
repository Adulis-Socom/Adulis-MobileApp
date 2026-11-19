// Runs a session against a file-backed fake device and is killed in the middle (restore.test.mjs).
// Not a test file: it is started by one.
import { makeAdb } from '../lib/adb.mjs';
import { applySetting, beginSession, deviceIdentity } from '../lib/restore.mjs';
import { fakeDevice, SERIAL } from './fake-device.mjs';

const [dir, file, killAt] = process.argv.slice(2);
const d = fakeDevice({ file });
const kill = async () => {
  process.kill(process.pid, 'SIGKILL');
  await new Promise((r) => setTimeout(r, 10_000));
};
const io = {
  adbBytes: d.io.adbBytes,
  adb: async (args) => {
    const hit = args.join(' ').includes('settings put system font_scale 1.3');
    if (hit && killAt === 'before-put') await kill();
    const r = await d.io.adb(args);
    if (hit && killAt === 'after-put') await kill();
    return r;
  },
};
const adb = makeAdb(io, SERIAL);
beginSession(dir, {
  run: 'native-20261118-aabbccdd',
  serial: SERIAL,
  identity: await deviceIdentity(adb),
});
await applySetting({ dir, adb, name: 'font_scale', target: '1.3' });
await applySetting({ dir, adb, name: 'reverse:57213', target: 'tcp:57213' });
if (killAt === 'after-applied') await kill();
console.log('KILL-CHILD-SURVIVED');
