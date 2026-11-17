/**
 * Python-identical arithmetic:
 * - pyRound(x, n): round(float, n), the exact binary value rounded half to even (round(2.675, 2) = 2.67);
 * - decimalRound(x, n): float(Decimal(str(x)).quantize(...)), half to even on the shortest repr;
 * - decimalSub(a, b): Decimal subtraction of two decimal strings, exact;
 * - erf(x): fdlibm's algorithm (as in C libraries), for the normal-distribution percentiles.
 */

function decompose(x: number): { neg: boolean; mant: bigint; exp: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0), lo = view.getUint32(4);
  const neg = (hi >>> 31) === 1;
  const biased = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exp: number;
  if (biased === 0) exp = -1074;
  else {
    mant |= 1n << 52n;
    exp = biased - 1075;
  }
  return { neg, mant, exp };
}

/** Rounds the exact decimal value N / 10^k to n places, half to even; returns a decimal string. */
function roundScaled(neg: boolean, N: bigint, k: number, n: number): string {
  let q: bigint;
  if (k <= n) q = N * 10n ** BigInt(n - k);
  else {
    const div = 10n ** BigInt(k - n);
    q = N / div;
    const r = N % div;
    const twice = 2n * r;
    if (twice > div || (twice === div && q % 2n === 1n)) q += 1n;
  }
  let digits = q.toString();
  if (n > 0) {
    digits = digits.padStart(n + 1, "0");
    digits = `${digits.slice(0, -n)}.${digits.slice(-n)}`;
  }
  return (neg && q !== 0n ? "-" : "") + digits;
}

/** Python's round(x, n) for a float (n >= 0). Also round(x) when n = 0 (Python returns an int). */
export function pyRound(x: number, n = 0): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const { neg, mant, exp } = decompose(x);
  let N: bigint, k: number;
  if (exp >= 0) {
    N = mant << BigInt(exp);
    k = 0;
  } else {
    k = -exp;
    N = mant * 5n ** BigInt(k);
  }
  const out = Number(roundScaled(neg, N, k, n));
  return out === 0 && neg ? -0 : out;
}

/** A decimal string -> [negative, N, k] with value N / 10^k (handles exponents). */
function parseDecimal(s: string): { neg: boolean; N: bigint; k: number } {
  let t = s.trim();
  const neg = t.startsWith("-");
  t = t.replace(/^[+-]/, "");
  let e = 0;
  const ei = t.search(/[eE]/);
  if (ei >= 0) {
    e = Number(t.slice(ei + 1));
    t = t.slice(0, ei);
  }
  const [whole, frac = ""] = t.split(".");
  let N = BigInt((whole || "0") + frac);
  let k = frac.length - e;
  if (k < 0) {
    N *= 10n ** BigInt(-k);
    k = 0;
  }
  return { neg, N, k };
}

/** float(Decimal(str(x)).quantize(Decimal(1).scaleb(-n))): half to even on the shortest repr. */
export function decimalRound(x: number, n = 1): number {
  if (!Number.isFinite(x)) return x;
  const { neg, N, k } = parseDecimal(String(x));
  return Number(roundScaled(neg, N, k, n));
}

/** Decimal("a") - Decimal("b"), exactly, as a number (float() of the result). */
export function decimalSub(a: string, b: string): number {
  const x = parseDecimal(a), y = parseDecimal(b);
  const k = Math.max(x.k, y.k);
  const nx = (x.neg ? -1n : 1n) * x.N * 10n ** BigInt(k - x.k);
  const ny = (y.neg ? -1n : 1n) * y.N * 10n ** BigInt(k - y.k);
  const d = nx - ny;
  const abs = d < 0n ? -d : d;
  let digits = abs.toString();
  if (k > 0) {
    digits = digits.padStart(k + 1, "0");
    digits = `${digits.slice(0, -k)}.${digits.slice(-k)}`;
  }
  return Number((d < 0n ? "-" : "") + digits);
}

// ---------------------------------------------------------------- erf (fdlibm s_erf.c)

const erx = 8.45062911510467529297e-01;
const efx = 1.28379167095512586316e-01, efx8 = 1.02703333676410069053e+00;
const pp0 = 1.28379167095512558561e-01, pp1 = -3.25042107247001499370e-01, pp2 = -2.84817495755985104766e-02,
  pp3 = -5.77027029648944159157e-03, pp4 = -2.37630166566501626084e-05;
const qq1 = 3.97917223959155352819e-01, qq2 = 6.50222499887672944485e-02, qq3 = 5.08130628187576562776e-03,
  qq4 = 1.32494738004321644526e-04, qq5 = -3.96022827877536812320e-06;
const pa0 = -2.36211856075265944077e-03, pa1 = 4.14856118683748331666e-01, pa2 = -3.72207876035701323847e-01,
  pa3 = 3.18346619901161753674e-01, pa4 = -1.10894694282396677476e-01, pa5 = 3.54783043256182359371e-02,
  pa6 = -2.16637559486879084300e-03;
const qa1 = 1.06420880400844228286e-01, qa2 = 5.40397917702171048937e-01, qa3 = 7.18286544141962662868e-02,
  qa4 = 1.26171219808761642112e-01, qa5 = 1.36370839120290507362e-02, qa6 = 1.19844998467991074170e-02;
const ra0 = -9.86494403484714822705e-03, ra1 = -6.93858572707181764372e-01, ra2 = -1.05586262253232909814e+01,
  ra3 = -6.23753324503260060396e+01, ra4 = -1.62396669462573470355e+02, ra5 = -1.84605092906711035994e+02,
  ra6 = -8.12874355063065934246e+01, ra7 = -9.81432934416914548592e+00;
const sa1 = 1.96512716674392571292e+01, sa2 = 1.37657754143519042600e+02, sa3 = 4.34565877475229228821e+02,
  sa4 = 6.45387271733267880336e+02, sa5 = 4.29008140027567833386e+02, sa6 = 1.08635005541779435134e+02,
  sa7 = 6.57024977031928170135e+00, sa8 = -6.04244152148580987438e-02;
const rb0 = -9.86494292470009928597e-03, rb1 = -7.99283237680523006574e-01, rb2 = -1.77579549177547519889e+01,
  rb3 = -1.60636384855821916062e+02, rb4 = -6.37566443368389627722e+02, rb5 = -1.02509513161107724954e+03,
  rb6 = -4.83519191608651397019e+02;
const sb1 = 3.03380607434824582924e+01, sb2 = 3.25792512996573918826e+02, sb3 = 1.53672958608443695994e+03,
  sb4 = 3.19985821950859553908e+03, sb5 = 2.55305040643316442583e+03, sb6 = 4.74528541206955367215e+02,
  sb7 = -2.24409524465858183362e+01;

function highWord(x: number): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  return v.getInt32(0);
}

function withLowWordZero(x: number): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  v.setUint32(4, 0);
  return v.getFloat64(0);
}

export function erf(x: number): number {
  const hx = highWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) return (1 - ((hx >>> 31) << 1)) + 1 / x;
  if (ix < 0x3feb0000) {
    if (ix < 0x3e300000) {
      if (ix < 0x00800000) return 0.125 * (8.0 * x + efx8 * x);
      return x + efx * x;
    }
    const z = x * x;
    const r = pp0 + z * (pp1 + z * (pp2 + z * (pp3 + z * pp4)));
    const s = 1 + z * (qq1 + z * (qq2 + z * (qq3 + z * (qq4 + z * qq5))));
    return x + x * (r / s);
  }
  if (ix < 0x3ff40000) {
    const s = Math.abs(x) - 1;
    const P = pa0 + s * (pa1 + s * (pa2 + s * (pa3 + s * (pa4 + s * (pa5 + s * pa6)))));
    const Q = 1 + s * (qa1 + s * (qa2 + s * (qa3 + s * (qa4 + s * (qa5 + s * qa6)))));
    return hx >= 0 ? erx + P / Q : -erx - P / Q;
  }
  if (ix >= 0x40180000) return hx >= 0 ? 1 - 1e-300 : 1e-300 - 1;
  const ax = Math.abs(x);
  const s = 1 / (ax * ax);
  let R: number, S: number;
  if (ix < 0x4006db6e) {
    R = ra0 + s * (ra1 + s * (ra2 + s * (ra3 + s * (ra4 + s * (ra5 + s * (ra6 + s * ra7))))));
    S = 1 + s * (sa1 + s * (sa2 + s * (sa3 + s * (sa4 + s * (sa5 + s * (sa6 + s * (sa7 + s * sa8)))))));
  } else {
    R = rb0 + s * (rb1 + s * (rb2 + s * (rb3 + s * (rb4 + s * (rb5 + s * rb6)))));
    S = 1 + s * (sb1 + s * (sb2 + s * (sb3 + s * (sb4 + s * (sb5 + s * (sb6 + s * sb7))))));
  }
  const z = withLowWordZero(ax);
  const r = Math.exp(-z * z - 0.5625) * Math.exp((z - ax) * (z + ax) + R / S);
  return hx >= 0 ? 1 - r / ax : r / ax - 1;
}
