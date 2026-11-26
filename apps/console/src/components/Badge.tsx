import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';
const ICON: Record<Tone, IconName> = { neutral: 'circle', success: 'check', warn: 'alert', danger: 'alert', info: 'info' };

/** Status is ALWAYS icon plus a word: colour reinforces, it never carries the state alone (CONSOLE-02 S168). */
export function Badge({ tone, icon, children }: { tone: Tone; icon?: IconName | undefined; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={icon ?? ICON[tone]} />
      <span>{children}</span>
    </span>
  );
}
