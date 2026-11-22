// mulberry32: a tiny seeded generator so a seed always rebuilds the same city
// and the same screenshot scene. Nothing here needs a library.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + (high - low) * rng();
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
