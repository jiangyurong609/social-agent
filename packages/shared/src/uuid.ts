export function randomId(prefix = ""): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}${(crypto as Crypto).randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2, 10);
  const rand2 = Math.random().toString(16).slice(2, 10);
  return `${prefix}${rand}${rand2}`;
}
