let warnedSet: Set<string> | undefined;

export function warnOnce(msg: string): void {
  if (typeof console !== 'undefined') {
    if (!warnedSet) warnedSet = new Set();
    if (!warnedSet.has(msg)) {
      warnedSet.add(msg);
      console.warn(msg);
    }
  }
}
