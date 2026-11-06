/** Columns named by SQLite's `UNIQUE constraint failed:` message, or null when it isn't one. */
export function uniqueConstraintTarget(error: unknown): string | null {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return /UNIQUE constraint failed: ([^\n]+)/.exec(parts.join("\n"))?.[1] ?? null;
}
