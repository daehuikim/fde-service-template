// Validate showcase/entries/*.json and render SHOWCASE.md plus the README showcase blocks.
// Usage: node scripts/showcase.mjs          (write generated files)
//        node scripts/showcase.mjs --check  (fail if entries are invalid or generated files are stale)
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';

const ENTRY_DIR = 'showcase/entries';
const SKILL_DIR = '.agents/skills';
const PAGE = 'SHOWCASE.md';
const READMES = {'README.md': 'en', 'README.ko.md': 'ko'};
const START = '<!-- showcase:start -->';
const END = '<!-- showcase:end -->';
const README_LIMIT = 5;

const SCHEMA = JSON.parse(readFileSync('showcase/schema.json', 'utf8'));
const DOMAINS = SCHEMA.properties.domain.enum;
const EVIDENCE = SCHEMA.properties.evidence.enum; // strongest first
const EVIDENCE_LABEL = {
  en: {production: 'Production', pilot: 'Pilot', 'desk-review': 'Desk review', synthetic: 'Synthetic'},
  ko: {production: '운영 적용', pilot: '파일럿', 'desk-review': '설계 검토', synthetic: '합성 예제'},
};
const KEYS = {
  required: SCHEMA.required,
  optional: Object.keys(SCHEMA.properties).filter((k) => !SCHEMA.required.includes(k)),
};
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const skills = new Set(readdirSync(SKILL_DIR, {withFileTypes: true}).filter((d) => d.isDirectory() && existsSync(`${SKILL_DIR}/${d.name}/SKILL.md`)).map((d) => d.name));

function httpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

function text(value, max) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\r\n|<>]/.test(value);
}

export function validate(file, raw) {
  const errors = [];
  const fail = (msg) => errors.push(`${file}: ${msg}`);
  let e;
  try {
    e = JSON.parse(raw);
  } catch (err) {
    fail(`invalid JSON (${err.message})`);
    return {errors};
  }
  if (!e || typeof e !== 'object' || Array.isArray(e)) return {errors: [`${file}: entry must be a JSON object`]};
  for (const k of KEYS.required) if (!(k in e)) fail(`missing "${k}"`);
  for (const k of Object.keys(e)) if (!KEYS.required.includes(k) && !KEYS.optional.includes(k)) fail(`unknown key "${k}"`);
  if (!ID.test(e.id ?? '') || e.id.length > 60) fail('"id" must be kebab-case, at most 60 characters');
  else if (`${e.id}.json` !== file) fail(`file name must be "${e.id}.json"`);
  if (!text(e.title, 80)) fail('"title" must be 1-80 characters with no line breaks, "|", "<" or ">"');
  if (!text(e.summary, 200)) fail('"summary" must be 1-200 characters with no line breaks, "|", "<" or ">"');
  if ('title_ko' in e && !text(e.title_ko, 80)) fail('"title_ko" must be 1-80 characters');
  if ('summary_ko' in e && !text(e.summary_ko, 200)) fail('"summary_ko" must be 1-200 characters');
  if (!httpsUrl(e.url)) fail('"url" must be an https URL');
  if ('source' in e && !httpsUrl(e.source)) fail('"source" must be an https URL');
  if (!Array.isArray(e.authors) || e.authors.length < 1 || e.authors.length > 10 || !e.authors.every((a) => typeof a === 'string' && LOGIN.test(a))) fail('"authors" must list 1-10 GitHub logins without "@"');
  else if (new Set(e.authors.map((a) => a.toLowerCase())).size !== e.authors.length) fail('"authors" has duplicates');
  if (!DATE.test(e.date ?? '') || Number.isNaN(Date.parse(`${e.date}T00:00:00Z`)) || new Date(`${e.date}T00:00:00Z`).toISOString().slice(0, 10) !== e.date) fail('"date" must be a real YYYY-MM-DD date');
  else if (Date.parse(`${e.date}T00:00:00Z`) > Date.now() + 2 * 864e5) fail('"date" is in the future');
  if (!DOMAINS.includes(e.domain)) fail(`"domain" must be one of: ${DOMAINS.join(', ')}`);
  if (!EVIDENCE.includes(e.evidence)) fail(`"evidence" must be one of: ${EVIDENCE.join(', ')}`);
  if (!Array.isArray(e.skills) || e.skills.length < 1 || e.skills.length > 8) fail('"skills" must list 1-8 skill names');
  else {
    if (new Set(e.skills).size !== e.skills.length) fail('"skills" has duplicates');
    for (const s of e.skills) if (!skills.has(s)) fail(`unknown skill "${s}" (see ${SKILL_DIR}/README.md)`);
  }
  if (!['en', 'ko', 'en+ko'].includes(e.language)) fail('"language" must be "en", "ko" or "en+ko"');
  if ('featured' in e && typeof e.featured !== 'boolean') fail('"featured" must be true or false');
  return {entry: e, errors};
}

export function load() {
  const errors = [];
  const entries = [];
  const urls = new Map();
  const files = existsSync(ENTRY_DIR) ? readdirSync(ENTRY_DIR).sort() : [];
  for (const file of files) {
    if (!file.endsWith('.json')) {
      errors.push(`${ENTRY_DIR}/${file}: only .json entries are allowed here`);
      continue;
    }
    const r = validate(file, readFileSync(`${ENTRY_DIR}/${file}`, 'utf8'));
    errors.push(...r.errors.map((m) => `${ENTRY_DIR}/${m}`));
    if (r.entry && !r.errors.length) {
      if (urls.has(r.entry.url)) errors.push(`${ENTRY_DIR}/${file}: same url as ${urls.get(r.entry.url)}`);
      urls.set(r.entry.url, file);
      entries.push(r.entry);
    }
  }
  return {entries: rank(entries), errors};
}

// Featured first, then stronger evidence, then newest, then id for a stable order.
export function rank(entries) {
  return [...entries].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || EVIDENCE.indexOf(a.evidence) - EVIDENCE.indexOf(b.evidence) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

const people = (list) => list.map((a) => `[@${a}](https://github.com/${a})`).join(', ');
const skillLinks = (list) => list.map((s) => `[${s}](.agents/skills/${s}/SKILL.md)`).join(' ');
const title = (e, lang) => (lang === 'ko' && e.title_ko) || e.title;
const summary = (e, lang) => (lang === 'ko' && e.summary_ko) || e.summary;
const star = (e) => (e.featured ? '⭐ ' : '');

function tally(entries, pick) {
  const counts = new Map();
  for (const e of entries) for (const k of pick(e)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function renderPage(entries) {
  const out = [
    '<!-- Generated by scripts/showcase.mjs from showcase/entries/*.json. Do not edit by hand; run `node scripts/showcase.mjs`. -->',
    '# Showcase · 사용 사례',
    '',
    'Real work done with FDE Workbench and its skills. Anyone can add an entry by pull request: see [how to submit](showcase/README.md).',
    '',
    'FDE Workbench와 skill로 진행한 사례 모음입니다. 누구나 PR로 사례를 추가할 수 있습니다: [제출 방법](showcase/README.md).',
    '',
    `**${entries.length}** entries · ranked by ⭐ maintainer pick → evidence level (${EVIDENCE.map((k) => EVIDENCE_LABEL.en[k]).join(' > ')}) → newest.`,
    '',
    'Evidence level says what the linked material demonstrates, not how good the outcome was. A synthetic example is not a claim of business impact.',
    '',
    '## Leaderboard',
    '',
  ];
  if (!entries.length) out.push('_No entries yet. Be the first: [submit one](showcase/README.md)._', '');
  else {
    out.push('| # | Case | Domain | Evidence | Skills | Authors | Date |', '|---:|---|---|---|---|---|---|');
    entries.forEach((e, i) => {
      const ko = e.title_ko ? `<br>${e.title_ko}` : '';
      out.push(`| ${i + 1} | ${star(e)}[${e.title}](${e.url})${ko}<br><sub>${e.summary}</sub> | ${e.domain} | ${EVIDENCE_LABEL.en[e.evidence]} | ${skillLinks(e.skills)} | ${people(e.authors)} | ${e.date} |`);
    });
    out.push('');
    out.push('## Contributors', '', '| Contributor | Entries |', '|---|---:|');
    for (const [who, n] of tally(entries, (e) => e.authors)) out.push(`| ${people([who])} | ${n} |`);
    out.push('', '## Skills in use', '', '| Skill | Entries |', '|---|---:|');
    for (const [s, n] of tally(entries, (e) => e.skills)) out.push(`| ${skillLinks([s])} | ${n} |`);
    out.push('', '## By domain', '', '| Domain | Entries |', '|---|---:|');
    for (const [d, n] of tally(entries, (e) => [e.domain])) out.push(`| ${d} | ${n} |`);
    out.push('');
  }
  return out.join('\n');
}

export function renderReadmeBlock(entries, lang) {
  const top = entries.slice(0, README_LIMIT);
  const lines = [START];
  if (!top.length) lines.push(lang === 'ko' ? '_아직 등록된 사례가 없습니다._' : '_No entries yet._');
  else {
    lines.push(lang === 'ko' ? '| 사례 | 분야 | 근거 수준 | 작성자 |' : '| Case | Domain | Evidence | Authors |', '|---|---|---|---|');
    for (const e of top) lines.push(`| ${star(e)}[${title(e, lang)}](${e.url}) — ${summary(e, lang)} | ${e.domain} | ${EVIDENCE_LABEL[lang][e.evidence]} | ${people(e.authors)} |`);
  }
  lines.push('');
  lines.push(lang === 'ko' ? `[전체 ${entries.length}건 보기](SHOWCASE.md) · [사례 추가하기](showcase/README.md)` : `[See all ${entries.length}](SHOWCASE.md) · [Add yours](showcase/README.md)`);
  lines.push(END);
  return lines.join('\n');
}

function replaceBlock(source, block, file) {
  const a = source.indexOf(START);
  const b = source.indexOf(END);
  if (a < 0 || b < a || source.indexOf(START, a + 1) >= 0) throw Error(`${file}: needs exactly one ${START} … ${END} block`);
  return source.slice(0, a) + block + source.slice(b + END.length);
}

function main() {
  const check = process.argv.includes('--check');
  const {entries, errors} = load();
  if (errors.length) {
    console.error(`showcase: ${errors.length} problem(s)\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const targets = {[PAGE]: renderPage(entries)};
  for (const [file, lang] of Object.entries(READMES)) targets[file] = replaceBlock(readFileSync(file, 'utf8'), renderReadmeBlock(entries, lang), file);
  const stale = [];
  for (const [file, content] of Object.entries(targets)) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (current === content) continue;
    if (check) stale.push(file);
    else writeFileSync(file, content);
  }
  if (stale.length) {
    console.error(`showcase: generated files are stale: ${stale.join(', ')}\nRun: node scripts/showcase.mjs`);
    process.exit(1);
  }
  console.log(`pass: ${entries.length} showcase entries${check ? ' valid and rendered' : ' rendered'}`);
}

if (process.argv[1]?.endsWith('showcase.mjs')) main();
