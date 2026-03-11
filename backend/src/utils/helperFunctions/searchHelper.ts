/**
 * Escape LIKE/ILIKE wildcard characters (%, _) in search terms
 * to prevent unintended pattern matching.
 *
 * Uses backslash as the escape character, which is PostgreSQL's default
 * LIKE escape character (no explicit ESCAPE clause needed).
 * See: https://www.postgresql.org/docs/current/functions-matching.html
 */
export function escapeLikeWildcards(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

/**
 * Build a safe ILIKE search term with wildcards.
 * User-supplied %, _, and \ characters are escaped so they match literally.
 */
export function buildSearchTerm(term: string): string {
  return `%${escapeLikeWildcards(term)}%`;
}
