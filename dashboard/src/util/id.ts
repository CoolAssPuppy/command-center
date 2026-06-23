/**
 * A short unique id for new config entities (zones, links, streams). Prefers the
 * platform UUID, with a timestamp fallback for environments that lack it.
 */
export function newId(prefix: string): string {
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const unique =
    cryptoLike?.randomUUID !== undefined
      ? cryptoLike.randomUUID().slice(0, 8)
      : Math.abs(hashString(`${prefix}:${performance.now()}`)).toString(36);
  return `${prefix}-${unique}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
