// What the native test harness must never touch, defined once. Everything here is a deny-list of
// resources that exist for other purposes; the allow-list is the run manifest (names, ports and ids
// the harness created itself). Both must agree before anything destructive runs.
import { PROTECTED_CONTAINERS as DEV_DB_CONTAINERS } from '../../scripts/lib/disposable-db.mjs';

export const OWNER = 'native-harness';
export const LABEL = {
  owner: 'adulis.native-harness.owner',
  run: 'adulis.native-harness.run',
  role: 'adulis.native-harness.role',
};

// Host ports the harness may use. Everything outside the block is refused, and the protected ports
// inside or outside it are refused a second time (belt and braces).
export const PORT_BLOCK = { from: 57100, to: 57999 };
export const PROTECTED_PORTS = new Set([
  1025, 3000, 5050, 5432, 5433, 5434, 6379, 8025, 9000, 9001, 9100, 55432, 55444, 59000,
]);
export const DEVICE_PORTS_EXTRA = new Set([8081]); // Metro: the one fixed port the harness reverses

const PROTECTED_CONTAINER_NAMES = new Set([
  ...DEV_DB_CONTAINERS,
  'adulis-minio',
  'adulis-minio-init',
  'adulis-minio-volume-guard',
  'adulis-final-check',
  'adulis-test-pg',
  'adulis-test-minio',
  'welcome-to-docker',
]);
const PROTECTED_VOLUMES = new Set(['adulis-pgdata', 'adulis-platform_adulis-pgdata']);
const PROTECTED_NETWORKS = new Set(['adulis-platform_default', 'bridge', 'host', 'none']);
export const PROTECTED_DATABASES = new Set([
  'adulis',
  'adulis_gates',
  'postgres',
  'template0',
  'template1',
]);

const PROTECTED_PREFIXES = ['nac-trial', 'adulis-platform', 'adulis-test'];
const hasProtectedPrefix = (n) => PROTECTED_PREFIXES.some((p) => `${n}`.startsWith(p));

export const isProtectedContainer = (n) =>
  PROTECTED_CONTAINER_NAMES.has(n) || hasProtectedPrefix(n);
export const isProtectedVolume = (n) => PROTECTED_VOLUMES.has(n) || hasProtectedPrefix(n);
export const isProtectedNetwork = (n) => PROTECTED_NETWORKS.has(n) || hasProtectedPrefix(n);

/** Any resource carrying a compose label belongs to a compose project, never to a harness run. */
export const hasComposeLabel = (labels) =>
  Object.keys(labels ?? {}).some((k) => k.startsWith('com.docker.compose.'));

/** Every name of this run's resources starts with this. */
export const namePrefix = (run8) => `adulis-native-${run8}-`;
