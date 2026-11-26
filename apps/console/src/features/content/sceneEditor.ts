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
}

export const canDo = (scene: SceneDetail, action: string): boolean => scene.allowed_actions.includes(action);
