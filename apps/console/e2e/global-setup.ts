/**
 * e2e/global-setup.ts -- one sign-in for the run.
 *
 * It does nothing itself: it calls the helper that owns authentication and
 * writes the cookies where `use.storageState` will find them. When
 * ADU-AUTH-01 v2.6 rules the mechanism, `signInAs` changes and this file does
 * not, because all it knows is that a session can be saved.
 */
import type { FullConfig } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { saveSignedInState, saveBuyerState } from './helpers/session';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_FILE = path.join(here, '.auth', 'state.json');
export const BUYER_STATE_FILE = path.join(here, '.auth', 'buyer-state.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  const channel = (config.projects[0]?.use as { channel?: string } | undefined)?.channel ?? 'msedge';
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const browser = await chromium.launch({ channel });
  try {
    await saveSignedInState(browser, STATE_FILE);
    await saveBuyerState(browser, BUYER_STATE_FILE);
  } finally {
    await browser.close();
  }
}
