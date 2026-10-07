import { ownedAt, terrainAt, dist, T } from "./world.js";
export function rangeFits(s, tee, target) {
  if (dist(tee, target) < 80 || !ownedAt(s, { x: tee.x + 12, y: tee.y }))
    return false;
  const a = Math.atan2(target.y - tee.y, target.x - tee.x);
  for (let i = 0; i <= 12; i++)
    for (const side of [-1, 0, 1]) {
      const t = i / 12,
        width = 12 + t * 28;
      if (
        !ownedAt(s, {
          x: tee.x + (target.x - tee.x) * t - Math.sin(a) * width * side,
          y: tee.y + (target.y - tee.y) * t + Math.cos(a) * width * side,
        })
      )
        return false;
    }
  return true;
}
export function suggestRange(s, tee, preferred = null) {
  let best = null,
    score = Infinity;
  for (const length of [180, 140, 100])
    for (let i = 0; i < 32; i++) {
      const angle =
        preferred === null
          ? (i * Math.PI) / 16
          : preferred + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 16;
      const target = {
        x: tee.x + Math.cos(angle) * length,
        y: tee.y + Math.sin(angle) * length,
      };
      if (!rangeFits(s, tee, target)) continue;
      let risk = 0;
      for (let j = 1; j <= 12; j++) {
        const q = {
            x: tee.x + ((target.x - tee.x) * j) / 12,
            y: tee.y + ((target.y - tee.y) * j) / 12,
          },
          t = terrainAt(s, q);
        risk +=
          t === T.WATER
            ? 8
            : t === T.TREE
              ? 4
              : t === T.GREEN
                ? 12
                : t === T.FAIRWAY
                  ? 3
                  : 0;
        for (const h of s.holes)
          if ((h.tee && dist(q, h.tee) < 25) || (h.pin && dist(q, h.pin) < 40))
            risk += 12;
      }
      const value =
        preferred === null
          ? risk + (180 - length) / 15
          : i + (180 - length) / 100;
      if (value < score) {
        score = value;
        best = { tee: { ...tee }, target };
      }
    }
  return best;
}
