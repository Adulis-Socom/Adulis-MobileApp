import type { CategoryAttributes, CategoryNode, ProductDetail } from '../../contracts/gap-sc-catalogue';

/** What every section of the Product editor receives. `detail` is always the latest server answer. */
export interface SectionProps {
  readonly detail: ProductDetail;
  /** Adopt the server's answer to a write. */
  readonly onChange: (next: ProductDetail) => void;
  /** Fetch the current state again (a stale version, or media still processing). Forms re-initialise from it. */
  readonly onReload: () => void;
  /** Fetch the current state again WITHOUT re-initialising forms (media still processing): unsaved typing survives. */
  readonly onRefresh: () => void;
  readonly timezone: string | undefined;
}

export interface CategorySectionProps extends SectionProps {
  readonly categories: readonly CategoryNode[];
}
export interface AttributeSectionProps extends SectionProps {
  /** Null while the Product has no saved category: the generic editor still works. */
  readonly attributes: CategoryAttributes | null;
}

export const can = (detail: ProductDetail, action: string): boolean => detail.allowed_actions.includes(action);

/** The category's full path from the server's tree, parents first: presentation only. */
export function categoryPath(node: CategoryNode, all: readonly CategoryNode[]): string {
  const parts: string[] = [];
  let at: CategoryNode | undefined = node;
  for (let depth = 0; at && depth < 8; depth += 1) {
    parts.unshift(at.label);
    const parent: string | null = at.parent_id;
    at = parent === null ? undefined : all.find((c) => c.id === parent);
  }
  return parts.join(' / ');
}
