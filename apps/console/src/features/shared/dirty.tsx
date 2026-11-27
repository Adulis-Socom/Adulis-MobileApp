import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { t } from '../../i18n/t';

/**
 * Unsaved work, in proportion. A page wraps its forms in one DirtyProvider; each form says whether it holds meaningful unsaved edits with
 * `useDirty(id, dirty)`. While ANY form is dirty:
 *  - internal navigation (links, Back, Forward, the Seller switcher) is held behind one question: stay or leave;
 *  - an explicit reload or closing the tab asks the browser's own question.
 * Nothing here ever obstructs a mandatory exit: navigation to sign-in (sign-out, expiry, revocation) always passes, and if the page itself is
 * replaced (expired session panel, Seller removed) the provider unmounts and the guard disappears with it.
 */
type SetDirty = (id: string, dirty: boolean) => void;
/** The setter is stable for the life of the page, so a form's effect never re-runs because ANOTHER form changed. */
const SetDirtyContext = createContext<SetDirty | null>(null);
/** The page-level flag changes; only the note reads it. */
const DirtyFlagContext = createContext(false);

/** A move to sign-in is a mandatory exit (sign-out, expiry, revocation), never a thing to ask about. */
export const isMandatoryExit = (pathname: string): boolean => pathname === '/sign-in' || pathname.startsWith('/sign-in/');

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const set = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const dirty = dirtyIds.size > 0;
  const blocker = useBlocker(({ nextLocation }) => dirty && !isMandatoryExit(nextLocation.pathname));

  useEffect(() => {
    if (!dirty) return undefined;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  return (
    <SetDirtyContext.Provider value={set}>
      <DirtyFlagContext.Provider value={dirty}>
      {children}
      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.state === 'blocked' && blocker.reset()} title={t('unsaved.title')}>
        <p>{t('unsaved.body')}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
            {t('unsaved.stay')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
            {t('unsaved.leave')}
          </button>
        </div>
      </Dialog>
      </DirtyFlagContext.Provider>
    </SetDirtyContext.Provider>
  );
}

/**
 * The page-level answer to "is anything unsaved?", placed under the page title. A polite status, so it is announced when it appears and
 * cleared when the last unsaved edit is saved or discarded. Each section still saves on its own, and the note says so.
 */
export function UnsavedNote() {
  const dirty = useContext(DirtyFlagContext);
  return (
    <p role="status" className={dirty ? 'notice' : 'sr-only'}>
      {dirty ? t('unsaved.note') : ''}
    </p>
  );
}

/** Report whether this form holds meaningful unsaved edits. Cleared when the form unmounts. Outside a provider it does nothing. */
export function useDirty(id: string, dirty: boolean): void {
  const set = useContext(SetDirtyContext);
  useEffect(() => {
    set?.(id, dirty);
    return () => set?.(id, false);
  }, [set, id, dirty]);
}
