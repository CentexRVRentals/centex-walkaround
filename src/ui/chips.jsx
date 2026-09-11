import { Chip } from "./atoms.jsx";

export function inspStatusChip(i) {
  if (i.status === "in_progress") return <Chip tone="neutral">In progress</Chip>;
  if (i.status === "review") return <Chip tone="orange">Needs review</Chip>;
  if (i.type === "return") {
    const n = (i.findings || []).filter((f) => f.ruling === "new").length;
    return n ? <Chip tone="orange">{n} new damage</Chip> : <Chip tone="green">No new damage</Chip>;
  }
  return <Chip tone="green">Complete</Chip>;
}
export function alignChip(score) {
  if (score == null) return null;
  if (score >= 70) return <Chip tone="green" small>Aligned {Math.round(score)}</Chip>;
  if (score >= 40) return <Chip tone="amber" small>Alignment {Math.round(score)}</Chip>;
  return <Chip tone="orange" small>Poor alignment {Math.round(score)}</Chip>;
}
