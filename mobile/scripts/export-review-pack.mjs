/**
 * Generates docs/TRANSLATION_REVIEW.md: every safety- or science-relevant UI string side by side
 * in English, Romanian and Russian, for native-speaker review. Read straight from the locale
 * files, so it can't drift from what the app shows. Re-run after editing translations:
 *   node scripts/export-review-pack.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(here, '../src/i18n/locales');
const outFile = path.resolve(here, '../../docs/TRANSLATION_REVIEW.md');
const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(path.resolve(here, '..')), '.review-'));

/** Transpile the locale .ts files to ESM .mjs (type-only imports are dropped). */
function load(lang) {
  for (const f of fs.readdirSync(localesDir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(localesDir, f), 'utf8').replace(/from '\.\/([\w.]+)'/g, "from './$1.mjs'");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    fs.writeFileSync(path.join(tmpDir, f.replace(/\.ts$/, '.mjs')), js.outputText);
  }
  return import(pathToFileURL(path.join(tmpDir, `${lang}.mjs`)).href).then((m) => m.default);
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (Array.isArray(v)) v.forEach((s, i) => (out[`${key}.${i + 1}`] = s));
    else flatten(v, key, out);
  }
  return out;
}

/** Which strings need expert review, grouped by why. */
const SECTIONS = [
  ['Safety screening and test-intensity outcomes', /^(readiness\.|onboarding\.(readiness|safetyNote))/],
  ['Test safety instructions', /^assess\.tests\.[a-z_0-9]+\.safety$/],
  ['Test protocols (steps)', /^assess\.tests\.[a-z_0-9]+\.steps\./],
  ['Test limitations', /^assess\.tests\.[a-z_0-9]+\.limitations$/],
  ['Result interpretation and caveats', /^assess\.(interpretations|notes)\./],
  ['Recommendations (general wellness guidance)', /^(recs\.|dashboard\.generalGuidance)/],
  ['Medical disclaimers', /^(welcome\.disclaimer|auth\.privacyNotice|auth\.consent)$/],
];

const cell = (s) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

try {
  const [en, ro, ru] = await Promise.all(['en', 'ro', 'ru'].map(load)).then((ls) => ls.map((l) => flatten(l)));
  let md = `# Translation review pack\n\n`;
  md += `Generated from \`mobile/src/i18n/locales\` by \`mobile/scripts/export-review-pack.mjs\`. **Do not edit by hand.**\n\n`;
  md += `Reviewers check that each Romanian and Russian text says *exactly* what the English says: same\n`;
  md += `safety meaning, same hedging ("may", "consider"), no added or lost warnings, no medical claims.\n`;
  md += `Mark each row OK or propose wording; the developer applies changes in the locale files.\n\n`;
  md += `| Reviewer | Language | Date | Result |\n|---|---|---|---|\n| | Română | | |\n| | Русский | | |\n\n`;
  let total = 0;
  for (const [title, re] of SECTIONS) {
    const keys = Object.keys(en).filter((k) => re.test(k));
    if (!keys.length) continue;
    total += keys.length;
    md += `## ${title} (${keys.length})\n\n| Key | English | Română | Русский | OK? |\n|---|---|---|---|---|\n`;
    for (const k of keys) md += `| \`${k}\` | ${cell(en[k])} | ${cell(ro[k])} | ${cell(ru[k])} | |\n`;
    md += '\n';
  }
  fs.writeFileSync(outFile, md);
  console.log(`wrote ${path.relative(process.cwd(), outFile)}: ${total} strings`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
