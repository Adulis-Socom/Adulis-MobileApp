// Test harness: a runtime over memory stores and an INJECTED transport. It never imports the fixtures (only the select seam and
// test files may), so each test file builds its own fixture world and passes the transport in.
import { QueryClient } from '@tanstack/react-query';

import { createMemoryDeviceStorage } from '../device/device';
import { createRuntime, type Runtime, type RuntimeOptions } from '../providers/runtime';
import { createMemoryCredentialStore, type MemoryCredentialStore } from '../session/credential-store';
import type { VerifyOutcome } from '../contracts/gap-mob-session';
import type { MobileTransport } from '../transport/port';

export const noImages = { clear: () => Promise.resolve() };

export interface Harness {
  readonly runtime: Runtime;
  readonly credentials: MemoryCredentialStore;
  readonly queryClient: QueryClient;
}

export async function makeRuntime(transport: MobileTransport, extra: Partial<RuntimeOptions> & { credentials?: MemoryCredentialStore } = {}): Promise<Harness> {
  const credentials = extra.credentials ?? createMemoryCredentialStore();
  const queryClient = new QueryClient();
  const runtime = await createRuntime({
    transport,
    credentials,
    deviceStorage: createMemoryDeviceStorage(),
    platform: 'android',
    queryClient,
    imageCache: noImages,
    deviceId: 'fx_device_test',
    ...extra,
  });
  return { runtime, credentials, queryClient };
}

/** Request a code and verify it, as the screens do. */
export async function signIn(runtime: Runtime, phone: string, code = '246810'): Promise<VerifyOutcome> {
  const sent = await runtime.session.requestCode({ destination: phone });
  if (sent.kind !== 'SENT') throw new Error(`requestCode did not send: ${sent.kind}`);
  return runtime.session.verifyCode({ challenge: sent.challenge, code, intentKey: 'ik-test' });
}

/** Let queued microtasks (the refresh a sign-in triggers) run. */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
