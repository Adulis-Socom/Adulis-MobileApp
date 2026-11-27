import type { SceneDetail } from '../../contracts/gap-sc-content';

/** What every section of the Scene editor receives. `scene` is always the latest server answer. */
export interface SceneSectionProps {
  readonly scene: SceneDetail;
  readonly onChange: (next: SceneDetail) => void;
  /** Fetch the state again and re-initialise the forms from it (a stale version). */
  readonly onReload: () => void;
  /** Fetch the state again WITHOUT re-initialising forms (an image still processing): unsaved work survives. */
  readonly onRefresh: () => void;
  readonly timezone: string | undefined;
  /** The Seller's own selected image, in browser memory only (revoked when replaced or when the editor closes). */
  readonly localImage: { readonly name: string; readonly url: string } | null;
  readonly onLocalImage: (file: File | null) => void;
}

/** Which pixels to show: the Seller's own selected file while the server holds none (then the stage measures it), else the server's derivative. */
export function imageSrc(scene: SceneDetail, localImage: SceneSectionProps['localImage']): { url: string | null; measure: boolean } {
  if (scene.image && localImage && localImage.name === scene.image.file_name) return { url: localImage.url, measure: true };
  return { url: scene.image?.preview_url ?? null, measure: false };
}

export const canDo = (scene: SceneDetail, action: string): boolean => scene.allowed_actions.includes(action);
