import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { GOOD_TOKEN, SIGNED_IN_CONTEXT, SIGN_IN_CODE, bootstrapBody, problem, type installFakeApi, type Recorded } from './fake-api';
import type { installFakeCollections } from './fake-collections';
import { TOKEN_KEY, memory } from './secure-store-mock';

/**
 * Two Accounts on one device for the Saved and Collections tests: Account A is restored from storage
 * (GOOD_TOKEN), the next sign-in is Account B. The fake Collections server has one owner, so it answers
 * A's Collections to ANY credential: a request that is made under B's credential would show in the
 * recorded calls and on screen, and the tests never rely on the server saying 404.
 */
export const TOKEN_B = 'Fake_credential_for_tests_B123456789abcdefg';
export const B_DEFAULT = '0c000000-0000-4000-8000-0000000000bb';
export const asA = (c: Recorded) => c.headers.Authorization === `Bearer ${GOOD_TOKEN}`;
export const asB = (c: Recorded) => c.headers.Authorization === `Bearer ${TOKEN_B}`;
/** A request that names this id in its path or query. */
export const naming = (id: string) => (c: Recorded) => c.path.includes(id) || JSON.stringify(c.query).includes(id) || JSON.stringify(c.body ?? {}).includes(id);

/** B signs in with the next verified code and owns only an empty Saved. */
export function accountB(api: ReturnType<typeof installFakeApi>, fc: ReturnType<typeof installFakeCollections>) {
  api.on('POST /v1/auth/otp/verify', (call) =>
    call.body?.code === SIGN_IN_CODE
      ? { status: 200, body: { account_id: '0b6f1a3e-1111-4111-8111-11111111111b', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: TOKEN_B } }
      : problem(401, 'OTP_INVALID', 'auth'),
  );
  api.on('GET /v1/bootstrap', (call) => ({ status: 200, body: bootstrapBody(call.headers.Authorization ? { account_context: SIGNED_IN_CONTEXT } : {}) }));
  fc.intercept('collections', (call) =>
    asB(call)
      ? {
          status: 200,
          body: {
            default_collection_ref: B_DEFAULT,
            data: [{ ref: B_DEFAULT, kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0, created_at: '2026-11-11T08:00:00.000000Z', updated_at: '2026-11-11T08:00:00.000000Z' }],
            next_cursor: null,
          },
        }
      : undefined,
  );
}

export const open = (path: string) => act(() => router.push(path as never));
export const flush = async () => {
  for (let i = 0; i < 20; i++) await act(() => Promise.resolve());
};

/**
 * From the screen on top: push You over it (whatever was open stays in the stack), sign out and sign in
 * as B through the real screens.
 */
export async function switchToB(phone = '+251911234567') {
  await open('/account');
  await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
  await screen.findByText(en['buyer.you.signed_out']);
  await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
  await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), phone);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
  await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
  await waitFor(() => expect(memory.get(TOKEN_KEY)).toBe(TOKEN_B));
}

/** Every request since A's sign-out request. */
export function afterSignOut(api: ReturnType<typeof installFakeApi>) {
  const at = api.calls.findIndex((c) => c.path === '/v1/auth/logout');
  expect(at).toBeGreaterThanOrEqual(0);
  return api.calls.slice(at + 1);
}
