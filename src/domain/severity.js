export const SEV = {
  minor:    { label: "Minor",    color: "#B07A0A" },
  moderate: { label: "Moderate", color: "#E4620E" },
  major:    { label: "Major",    color: "#C0311A" },
};
export const isSeverity = (s) => Object.prototype.hasOwnProperty.call(SEV, s);
