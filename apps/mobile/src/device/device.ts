// Device context (MOB-FE-01 s6, GAP-L2-01). The device id is generated ONCE and kept across launch, sign-out and expiry. It
// is not a credential. Registration is one attempt in flight at a time; concurrent callers share it. Network state is
// observed from the OS and never persisted.
import { asDeviceId, type DeviceContext, type DeviceId, type DeviceRegistration, type NetworkState } from '../contracts/gap-mob-session';
import { TransportError } from '../transport/port';

export interface DeviceStorage {
  readId(): Promise<string | null>;
  writeId(id: string): Promise<void>;
  readRegistered(): Promise<string | null>;
  writeRegistered(id: string): Promise<void>;
}

/** Memory only: the fixture environment and the test double. Nothing a fixture mints reaches the native store. */
export function createMemoryDeviceStorage(initial: { id?: string | null; registered?: string | null } = {}): DeviceStorage {
  let id = initial.id ?? null;
  let registered = initial.registered ?? null;
  return {
    readId: () => Promise.resolve(id),
    writeId: (next) => Promise.resolve(void (id = next)),
    readRegistered: () => Promise.resolve(registered),
    writeRegistered: (next) => Promise.resolve(void (registered = next)),
  };
}

/** A real identifier never begins with the reserved fixture prefix. */
export function newDeviceId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const body = uuid ?? Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `dv-${body}`;
}

/** Create once. An unreadable store gives a process-lifetime id (never persisted by guesswork); a failed write is not fatal. */
export async function loadDeviceId(storage: DeviceStorage, generate: () => string = newDeviceId): Promise<DeviceId> {
  try {
    const existing = await storage.readId();
    if (existing) return asDeviceId(existing);
  } catch {
    return asDeviceId(generate());
  }
  const created = generate();
  try {
    await storage.writeId(created);
  } catch {
    // Not persisted: this process keeps the id, and the next launch creates another.
  }
  return asDeviceId(created);
}

export class DeviceController {
  private state: DeviceContext;
  private inflight: Promise<DeviceRegistration> | null = null;
  private readonly listeners = new Set<(next: DeviceContext) => void>();

  constructor(
    deviceId: DeviceId,
    platform: 'android' | 'ios',
    private readonly storage: DeviceStorage,
  ) {
    this.state = { deviceId, platform, registration: { kind: 'UNREGISTERED' }, network: 'UNKNOWN' };
  }

  context(): DeviceContext {
    return this.state;
  }
  subscribe(listener: (next: DeviceContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private set(patch: Partial<Pick<DeviceContext, 'registration' | 'network'>>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  setNetwork(network: NetworkState): void {
    if (network !== this.state.network) this.set({ network });
  }

  /** `register` is the one device.register call (made through the session manager). Never rejects. */
  ensureRegistered(register: () => Promise<unknown>): Promise<DeviceRegistration> {
    if (this.state.registration.kind === 'REGISTERED') return Promise.resolve(this.state.registration);
    this.inflight ??= this.attempt(register).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async attempt(register: () => Promise<unknown>): Promise<DeviceRegistration> {
    try {
      if ((await this.storage.readRegistered()) === this.state.deviceId) {
        this.set({ registration: { kind: 'REGISTERED' } });
        return this.state.registration;
      }
    } catch {
      // Unknown: fall through and register again; registration is idempotent for a device id.
    }
    this.set({ registration: { kind: 'REGISTERING' } });
    try {
      await register();
    } catch (error) {
      const refused = error instanceof TransportError && (error.code === 'PERMISSION_DENIED' || error.code === 'REFUSED' || error.code === 'AUDIENCE_NOT_PERMITTED');
      this.set({ registration: refused ? { kind: 'REFUSED', message: error.serverMessage } : { kind: 'UNREGISTERED' } }); // offline or unavailable: try again later
      return this.state.registration;
    }
    try {
      await this.storage.writeRegistered(this.state.deviceId);
    } catch {
      // Registered this process; the next launch registers again.
    }
    this.set({ registration: { kind: 'REGISTERED' } });
    return this.state.registration;
  }
}
