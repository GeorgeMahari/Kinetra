/**
 * The parent's consent pages (backend/app/modules/consent/pages.py): no scripts, no external
 * resources, every inserted value escaped. Texts come from pages.json, exported from Python.
 */
import P from "./pages.json" with { type: "json" };

type Texts = Record<string, string | string[]>;
const T = P.T as Record<string, Texts>;
export const CSP = P.CSP;

/** Python's html.escape(s, quote=True). */
export function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

export function texts(lang: string): Texts {
  return T[lang] ?? T.en;
}

function page(lang: string, body: string): string {
  const t = texts(lang);
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    `<title>${escapeHtml(String(t.title))}</title><style>${P.STYLE}</style></head>` +
    `<body><h1>${escapeHtml(String(t.title))}</h1>${body}</body></html>`;
}

export function consentForm(lang: string, childEmail: string, action: string): string {
  const t = texts(lang);
  const items = (t.items as string[]).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const never = (t.never_items as string[]).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const body = `<p>${escapeHtml(String(t.intro).replace("{child}", childEmail))}</p>` +
    `<div class="card"><p>${escapeHtml(String(t.what))}</p>` +
    `<h2>${escapeHtml(String(t.collects))}</h2><ul>${items}</ul>` +
    `<h2>${escapeHtml(String(t.never))}</h2><ul>${never}</ul>` +
    `<p>${escapeHtml(String(t.rights))}</p></div>` +
    `<form method="post" action="${escapeHtml(action)}">` +
    `<button class="agree" name="decision" value="grant">${escapeHtml(String(t.agree))}</button>` +
    `<button class="refuse" name="decision" value="refuse">${escapeHtml(String(t.refuse))}</button>` +
    "</form>";
  return page(lang, body);
}

export function message(lang: string, key: string): string {
  return page(lang, `<div class="card"><p>${escapeHtml(String(texts(lang)[key]))}</p></div>`);
}
