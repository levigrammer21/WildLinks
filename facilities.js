import { ownedAt, dist } from "./world.js";
export function facilityBuildings(s) {
  return [
    { id: "check", name: "CHECK-IN", x: 38, y: 30 },
    ...[...new Set(s.facilities)]
      .filter((id) => id !== "range")
      .map((id, i) => ({
        id,
        name: id.toUpperCase(),
        x: 38 + (i % 4) * 42,
        y: 72 + Math.floor(i / 4) * 38,
      })),
  ].map((b) => ({ ...b, ...s.facilityPositions?.[b.id] }));
}
export function facilityPosition(s, id) {
  const b = facilityBuildings(s).find((b) => b.id === id);
  return b ? { x: b.x, y: b.y } : null;
}
export function validateFacilityPosition(s, id, center) {
  for (const dx of [-22, 22])
    for (const dy of [-26, 22])
      if (!ownedAt(s, { x: center.x + dx, y: center.y + dy }))
        throw Error("Keep the whole building on owned land.");
  for (const b of facilityBuildings(s))
    if (b.id !== id && dist(b, center) < 36)
      throw Error("Leave a little space between buildings.");
}
