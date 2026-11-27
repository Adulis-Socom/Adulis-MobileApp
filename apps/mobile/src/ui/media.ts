// The media seam (GAP-L2-02, MEDIA-01). A picture is a reference the server sends; turning it into something drawable is this
// one context. The LIVE resolver has no origin yet and returns null (the neutral placeholder): no production media origin is
// invented. A development fixture build supplies its own resolver for bundled demonstration pictures through the selection.
import { createContext, useContext } from 'react';

export type MediaResolver = (ref: string) => number | null;

/** Live: no media origin is configured, so nothing resolves (SR-L2M01-MEDIA-01). */
export const liveMedia: MediaResolver = () => null;

export const MediaContext = createContext<MediaResolver>(liveMedia);
export const useMediaResolver = (): MediaResolver => useContext(MediaContext);
