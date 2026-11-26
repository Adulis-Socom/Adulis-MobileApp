import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The Seller's own selected files, shown back to them as local previews. Browser-memory only: nothing is uploaded, stored or
 * persisted, and every URL is revoked when it is replaced, dropped, or the owner unmounts (so a closed screen holds no image).
 * `set` takes ownership of a File; `release` hands a URL to a new owner, which then becomes responsible for revoking it.
 */
export interface ObjectUrls {
  get(key: string): string | undefined;
  set(key: string, file: Blob): string;
  drop(key: string): void;
  /** Stop managing this key without revoking, because another owner now holds the URL. */
  release(key: string): string | undefined;
}

export function useObjectUrls(): ObjectUrls {
  const urls = useRef(new Map<string, string>());
  const [, rerender] = useState(0);
  useEffect(() => {
    const held = urls.current;
    return () => {
      for (const url of held.values()) URL.revokeObjectURL(url);
      held.clear();
    };
  }, []);
  const get = useCallback((key: string) => urls.current.get(key), []);
  const set = useCallback((key: string, file: Blob) => {
    const old = urls.current.get(key);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    urls.current.set(key, url);
    rerender((n) => n + 1);
    return url;
  }, []);
  const drop = useCallback((key: string) => {
    const old = urls.current.get(key);
    if (old) URL.revokeObjectURL(old);
    urls.current.delete(key);
    rerender((n) => n + 1);
  }, []);
  const release = useCallback((key: string) => {
    const url = urls.current.get(key);
    urls.current.delete(key);
    return url;
  }, []);
  return { get, set, drop, release };
}
