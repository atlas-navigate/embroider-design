import { CATALOGUE } from './data/index.js';
import { CATEGORIES, type CategoryId, type LibraryShape, type ShapeCategory } from './types.js';

/**
 * Looking things up in the catalogue.
 *
 * The indexes are built once at module load. Two hundred entries is small
 * enough that a linear scan would be fine, but the search box runs on every
 * keystroke and there is no reason to make the UI wait on work that never
 * changes.
 */

const byId = new Map<string, LibraryShape>();
const byCategory = new Map<CategoryId, LibraryShape[]>();

for (const category of CATEGORIES) byCategory.set(category.id, []);
for (const shape of CATALOGUE) {
  byId.set(shape.id, shape);
  byCategory.get(shape.category)?.push(shape);
}

export function allShapes(): readonly LibraryShape[] {
  return CATALOGUE;
}

export function shapeById(id: string): LibraryShape | null {
  return byId.get(id) ?? null;
}

export function shapesInCategory(category: CategoryId): readonly LibraryShape[] {
  return byCategory.get(category) ?? [];
}

/** Categories that actually contain something, so the UI never shows an empty list. */
export function populatedCategories(): readonly ShapeCategory[] {
  return CATEGORIES.filter((category) => (byCategory.get(category.id)?.length ?? 0) > 0);
}

/** Pre-lowercased haystacks, so searching does not re-normalise on every keystroke. */
const haystacks = new Map<string, string>();
for (const shape of CATALOGUE) {
  haystacks.set(
    shape.id,
    `${shape.name} ${shape.category} ${(shape.keywords ?? []).join(' ')}`.toLowerCase(),
  );
}

/**
 * Free-text search over name, category and keywords.
 *
 * Every term has to match somewhere, so "christmas star" narrows rather than
 * widening — the opposite behaviour makes a 200-item catalogue useless.
 */
export function searchShapes(query: string, within?: CategoryId): readonly LibraryShape[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = within ? shapesInCategory(within) : CATALOGUE;
  if (terms.length === 0) return pool;
  return pool.filter((shape) => {
    const haystack = haystacks.get(shape.id) ?? '';
    return terms.every((term) => haystack.includes(term));
  });
}
