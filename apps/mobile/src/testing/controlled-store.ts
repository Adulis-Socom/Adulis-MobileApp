// A credential store whose operations a test can HOLD and then release or fail, one at a time, in a chosen order. Everything not
// held behaves like the memory store (including its `fail` switches). Deterministic: no timers, no real storage.
import { createMemoryCredentialStore, type MemoryCredentialStore } from '../session/credential-store';

export type StoreOp = 'read' | 'write' | 'delete' | 'readFlag' | 'writeFlag';

interface Gate {
  readonly promise: Promise<void>;
  release(): void;
  fail(): void;
}

function gate(): Gate {
  let release: () => void = () => undefined;
  let fail: () => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    release = resolve;
    fail = () => reject(new Error('held storage operation failed'));
  });
  return { promise, release, fail };
}

export interface ControlledStore extends MemoryCredentialStore {
  /** The NEXT call of `op` waits until the returned gate is released (it then runs) or failed (it then throws). */
  hold(op: StoreOp): Pick<Gate, 'release' | 'fail'>;
  /** Every operation in call order, with its argument (tests assert ordering). */
  readonly log: string[];
}

export function createControlledStore(initial: { token?: string | null; flag?: boolean } = {}): ControlledStore {
  const base = createMemoryCredentialStore(initial);
  const holds = new Map<StoreOp, Gate[]>();
  const log: string[] = [];
  const wait = async (op: StoreOp, arg: string) => {
    log.push(arg === '' ? op : `${op}:${arg}`);
    const held = holds.get(op)?.shift();
    if (held) await held.promise;
  };
  return {
    fail: base.fail,
    peek: base.peek,
    peekFlag: base.peekFlag,
    log,
    hold(op) {
      const g = gate();
      holds.set(op, [...(holds.get(op) ?? []), g]);
      return { release: g.release, fail: g.fail };
    },
    read: async () => {
      await wait('read', '');
      return base.read();
    },
    write: async (credential) => {
      await wait('write', credential);
      return base.write(credential);
    },
    delete: async () => {
      await wait('delete', '');
      return base.delete();
    },
    readSignedOutFlag: async () => {
      await wait('readFlag', '');
      return base.readSignedOutFlag();
    },
    writeSignedOutFlag: async (on) => {
      await wait('writeFlag', String(on));
      return base.writeSignedOutFlag(on);
    },
  };
}

/** Lets every queued microtask and zero-delay timer run. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
