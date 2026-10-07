// Comparable rounds have the same routing and actual tee configuration.
export function normalizeRecord(s, record) {
  const r = { ...record },
    ids = String(r.layout || "")
      .split(":")[0]
      .split(",");
  const set = r.teeSet || String(r.layout || "").split(":")[1] || "standard";
  r.teeSet =
    set !== "standard" &&
    ids.some((id) => s.holes.find((h) => String(h.id) === id)?.tees?.[set])
      ? set
      : "standard";
  r.layout = ids.join(",") + (r.teeSet === "standard" ? "" : ":" + r.teeSet);
  return r;
}
export function seedRecordBooks(s) {
  const rounds = [
    ...Object.values(s.recordBook || {}),
    ...Object.values(s.records || {}),
    ...(s.recordHistory || []),
  ].filter((r) => r && !r.pickup);
  const historyBest = {},
    history = [];
  for (const record of [...(s.recordHistory || [])].reverse()) {
    const r = normalizeRecord(s, record);
    if (
      !r.pickup &&
      (!historyBest[r.layout] || r.relative < historyBest[r.layout].relative)
    ) {
      historyBest[r.layout] = r;
      history.unshift(r);
    }
  }
  s.recordHistory = history;
  s.recordBook = {};
  s.personalRecordBook ||= {};
  s.visitorRecordBook ||= {};
  for (const record of rounds) {
    const r = normalizeRecord(s, record);
    for (const book of [
      s.recordBook,
      r.player ? s.personalRecordBook : s.visitorRecordBook,
    ])
      if (!book[r.layout] || r.relative < book[r.layout].relative)
        book[r.layout] = r;
  }
  for (const key of Object.keys(s.records || {})) {
    const old = s.records[key];
    if (!old) continue;
    const r = normalizeRecord(s, old),
      book =
        key === "personal"
          ? s.personalRecordBook
          : key === "ai"
            ? s.visitorRecordBook
            : s.recordBook;
    s.records[key] = book[r.layout] || null;
  }
}
export function shouldReplaceSummary(previous, next) {
  return (
    !previous ||
    next.holes > previous.holes ||
    (previous.layout === next.layout && next.relative < previous.relative)
  );
}
