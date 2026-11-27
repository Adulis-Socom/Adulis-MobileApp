// Where the credential lives. The credential is never a member of any state object, a query key or a log line.
//
// Two slots, because a failed delete must not silently restore a signed-out Account: the SIGNED-OUT FLAG is written
// before the delete and cleared only after it succeeded. A restore that finds the flag set never restores, whatever the
// token slot still holds (fail closed), and retries the delete.
export interface CredentialStore {
  read(): Promise<string | null>;
  write(credential: string): Promise<void>;
  delete(): Promise<void>;
  readSignedOutFlag(): Promise<boolean>;
  writeSignedOutFlag(on: boolean): Promise<void>;
}

/** Memory only: the fixture session (never the native store) and the test double. `fail` injects storage failures. */
export interface MemoryCredentialStore extends CredentialStore {
  readonly fail: { read: boolean; write: boolean; delete: boolean; readFlag: boolean; writeFlag: boolean };
  /** What the token slot holds right now (tests). */
  peek(): string | null;
  peekFlag(): boolean;
}

export function createMemoryCredentialStore(initial: { token?: string | null; flag?: boolean } = {}): MemoryCredentialStore {
  let token: string | null = initial.token ?? null;
  let flag = initial.flag ?? false;
  const fail = { read: false, write: false, delete: false, readFlag: false, writeFlag: false };
  const guard = (broken: boolean) => (broken ? Promise.reject(new Error('storage failure')) : Promise.resolve());
  return {
    fail,
    peek: () => token,
    peekFlag: () => flag,
    read: () => guard(fail.read).then(() => token),
    write: (credential) => guard(fail.write).then(() => void (token = credential)),
    delete: () => guard(fail.delete).then(() => void (token = null)),
    readSignedOutFlag: () => guard(fail.readFlag).then(() => flag),
    writeSignedOutFlag: (on) => guard(fail.writeFlag).then(() => void (flag = on)),
  };
}
