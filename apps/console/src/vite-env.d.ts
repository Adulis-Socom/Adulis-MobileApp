/// <reference types="vite/client" />

/**
 * Injected by vite.config.ts from apps/console/package.json.
 *
 * ADU-API-01 S3 requires X-Adulis-Client on every request, formatted
 * `surface/version`. A literal in the source would be a version that lies the
 * first time someone forgets to bump it, so the build supplies it.
 */
declare const __APP_VERSION__: string;
