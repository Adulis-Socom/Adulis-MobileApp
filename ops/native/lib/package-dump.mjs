// `dumpsys package <id>` read for one package: only that package's own block counts, so another
// package's flags in the same output are never taken for its own. No imports: the device facts and the
// build verification both use it.
export function parsePackage(dump, appId) {
  const at = dump.indexOf(`Package [${appId}]`);
  if (at < 0) return { installed: false };
  const rest = dump.slice(at + 1);
  const next = rest.search(/\n {2}Package \[|\n[A-Z][A-Za-z ]+:\n/);
  const block = next < 0 ? rest : rest.slice(0, next);
  const num = (re) => {
    const m = re.exec(block);
    return m ? Number(m[1]) : null;
  };
  const flags = /(?:pkgFlags|flags)=\[([^\]]*)\]/.exec(block)?.[1] ?? '';
  return {
    installed: true,
    debuggable: /\bDEBUGGABLE\b/.test(flags),
    primaryCpuAbi: /primaryCpuAbi=(\S+)/.exec(block)?.[1] ?? null,
    versionCode: num(/versionCode=(\d+)/),
    minSdk: num(/minSdk=(\d+)/),
    targetSdk: num(/targetSdk=(\d+)/),
    versionName: /versionName=(\S+)/.exec(block)?.[1] ?? null,
  };
}
