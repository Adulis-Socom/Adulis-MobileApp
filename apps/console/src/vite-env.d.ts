/// <reference types="vite/client" />

/**
 * Injected by vite.config.ts from apps/console/package.json.
 *
 * ADU-API-01 S3 requires X-Adulis-Client on every request, formatted
 * `surface/version`. The build supplies it so the header cannot drift from
 * the package independently -- though the package is still 0.0.0 and has
 * always been, so today the header honestly reports an unversioned build
 * rather than a wrong version. It becomes useful the day releases are cut.
 */
declare const __APP_VERSION__: string;
