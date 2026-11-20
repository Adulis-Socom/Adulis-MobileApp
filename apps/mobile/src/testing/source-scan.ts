// The mobile tsconfig carries no Node typings, so the few Node calls the scans need are described here.
type Fs = {
  readdirSync(dir: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, encoding: 'utf8'): string;
};
type Path = { resolve(...parts: string[]): string; join(...parts: string[]): string; posix: { join(...parts: string[]): string } };
declare const __dirname: string;
const fs = jest.requireActual<Fs>('node:fs');
const path = jest.requireActual<Path>('node:path');

/** `apps/mobile/src`, found from this file so the scans work from any working directory. */
const SRC = path.resolve(__dirname, '..');

export type SourceFile = { file: string; text: string };

function walk(dir: string, withTests: boolean): SourceFile[] {
  return fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = dir === '.' ? entry.name : path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel, withTests);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (!withTests && /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [{ file: rel, text: fs.readFileSync(path.join(SRC, rel), 'utf8') }];
  });
}

/** The app's own sources (no test files) under these folders of `src`, as `folder/file.tsx` names. */
export function productionSources(...dirs: string[]): SourceFile[] {
  return dirs.flatMap((dir) => walk(dir, false));
}

/** Folders of `src` that draw nothing a person reads or touches: fixtures, tokens, the API client, device and storage plumbing, state, catalogue plumbing. */
export const NON_UI_DIRS: readonly string[] = ['testing', 'theme', 'api', 'device', 'state', 'storage', 'i18n'];

/** Every production source that can draw a screen: all of `src` except NON_UI_DIRS, so a new folder is read by default. */
export function uiSources(): SourceFile[] {
  return walk('.', false).filter(({ file }) => !NON_UI_DIRS.includes(file.split('/')[0] ?? ''));
}

/** Every source file under `src`, test files included (for checks that no file may import something). */
export function allSources(): SourceFile[] {
  return walk('.', true);
}

/** The files directly inside a repository folder whose name ends with `suffix`, as `name` and text (for a test that reads every migration). */
export function repoFolderFiles(fromRoot: string, suffix: string): SourceFile[] {
  const dir = path.resolve(SRC, '../../..', fromRoot);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory() && entry.name.endsWith(suffix))
    .map((entry) => ({ file: entry.name, text: fs.readFileSync(path.join(dir, entry.name), 'utf8') }));
}

/** A file of the repository by its path from the repository root (for a test that checks a package's twin file). */
export function repoFile(fromRoot: string): string {
  return fs.readFileSync(path.resolve(SRC, '../../..', fromRoot), 'utf8');
}
