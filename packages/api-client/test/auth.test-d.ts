/**
 * WO-API-001A -- the auth, session, device and bootstrap contract is typed,
 * and its security-relevant shape is pinned at compile time. Run by `test`
 * (tsc over tsconfig.test.json); a failing assertion is a type error.
 */
import type { components, paths } from '../src/index';

type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Json<R> = R extends { content: { 'application/json': infer B } } ? B : never;
type S = components['schemas'];

// Sign-in: typed body, required Idempotency-Key, typed response. The bearer
// is optional because a CONSOLE sign-in receives a cookie instead.
type Verify = paths['/v1/auth/otp/verify']['post'];
type _VerifyBody = Assert<Equal<Json<Verify['requestBody']>, S['OtpVerifyBodyDto']>>;
type _VerifyKey = Assert<Equal<Verify['parameters']['header'], { 'Idempotency-Key': string }>>;
type _VerifyOk = Assert<Equal<Json<Verify['responses'][200]>, S['OtpVerifyResponseDto']>>;
type _Token = Assert<Equal<S['OtpVerifyResponseDto']['token'], string | undefined>>;
type _Request = Assert<Equal<Json<paths['/v1/auth/otp/request']['post']['requestBody']>, S['OtpRequestBodyDto']>>;

// Session list (SEC-1): public ids only. No credential, hash or device id field.
type _List = Assert<Equal<Json<paths['/v1/auth/sessions']['get']['responses'][200]>, S['SessionListResponseDto']>>;
type _NoSecret = Assert<Equal<Extract<keyof S['SessionDto'], 'token' | 'token_hash' | 'device_id'>, never>>;

// Logout and revocation (SEC-4).
type _Logout = Assert<Equal<keyof paths['/v1/auth/logout']['post']['responses'], 204 | 'default'>>;
type _RevokeOne = Assert<
  Equal<Json<NonNullable<paths['/v1/auth/sessions/{id}']['delete']['requestBody']>>, S['RevokeSessionBodyDto']>
>;
type _RevokeOthers = Assert<
  Equal<Json<paths['/v1/auth/sessions/revoke-others']['post']['responses'][200]>, S['RevokeOthersResponseDto']>
>;

// Device update (SEC-2).
type _Patch = Assert<Equal<Json<paths['/v1/devices/{id}']['patch']['requestBody']>, S['DevicePatchBodyDto']>>;

// Bootstrap account_context: nullable, exactly three server-derived modes.
type Ctx = S['BootstrapResponseDto']['account_context'];
type _Ctx = Assert<Equal<Ctx, S['AccountContextDto'] | null>>;
type _Modes = Assert<Equal<keyof NonNullable<Ctx>, 'buyer' | 'seller_companion' | 'courier'>>;
type _Mode = Assert<Equal<S['ModeAvailabilityDto'], { available: boolean }>>;

// Errors: a typed problem, under the media type the server really sends,
// with the catalogue's closed code set.
type Problem<R> = R extends { content: { 'application/problem+json': infer B } } ? B : never;
type _Problem = Assert<Equal<Problem<Verify['responses']['default']>, S['ProblemDto']>>;
type _Code = Assert<'OTP_EXPIRED' extends S['ProblemDto']['code'] ? true : false>;
