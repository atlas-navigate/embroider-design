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

function haystackFor(shape: LibraryShape): string {
  return `${shape.name} ${shape.category} ${(shape.keywords ?? []).join(' ')}`.toLowerCase();
}

/** Pre-lowercased haystacks, so searching does not re-normalise on every keystroke. */
const haystacks = new Map<string, string>();
for (const shape of CATALOGUE) haystacks.set(shape.id, haystackFor(shape));

/**
 * Free-text search over any list of shapes.
 *
 * Split out from `searchShapes` so the user's own saved shapes are matched by
 * exactly the same rules as the shipped ones. A second, subtly different search
 * for the custom library is the kind of thing nobody notices until someone
 * types two words and their own shape is the one that fails to appear.
 *
 * Every term has to match somewhere, so "christmas star" narrows rather than
 * widening — the opposite behaviour makes a 200-item catalogue useless.
 */
export function searchShapeList(
  shapes: readonly LibraryShape[],
  query: string,
): readonly LibraryShape[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return shapes;
  return shapes.filter((shape) => {
    const haystack = haystacks.get(shape.id) ?? haystackFor(shape);
    return terms.every((term) => haystack.includes(term));
  });
}

/** Free-text search over the shipped catalogue. */
export function searchShapes(query: string, within?: CategoryId): readonly LibraryShape[] {
  return searchShapeList(within ? shapesInCategory(within) : CATALOGUE, query);
}
