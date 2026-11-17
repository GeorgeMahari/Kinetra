/**
 * Python's repr() for JSON values, used where Python measures or prints one (the onboarding draft's
 * size limit, list values in error messages). JSON cannot tell 1 from 1.0, so whole floats print as
 * integers; that shifts a measured length by at most two characters per such number.
 */
function reprString(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
    else if (c >= 0x80 && c <= 0xa0) out += "\\x" + c.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + quote;
}

export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return reprString(v);
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  if (typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${reprString(k)}: ${pyRepr(x)}`).join(", ")}}`;
  }
  return String(v);
}

/** repr() of a sorted list of strings, e.g. ['a', 'b']. */
export function reprList(xs: string[]): string {
  return `[${xs.map(reprString).join(", ")}]`;
}
