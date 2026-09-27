/**
 * Site integrity tests. Run: npm test  (node test/site.test.js; no dependencies)
 *
 * 1. Every local href/src/srcset in index.html resolves to a file in the repo.
 * 2. Every PDF in docs/ is linked from index.html at its own path.
 * 3. docs/ is untouched: same file names as on `main`, each byte-identical (sha256).
 * 4. Every pose of the turning hero (assets/turn/pose-*.webp) is referenced, and the default is the front pose.
 *    The turn is driven by scroll alone: no pointer-follow, tilt or tap-to-enable code; it starts and ends facing front.
 * 5. Nothing points at files the redesign removed.
 * 6. The surname is spelled "Solá".
 * 7. Every referee's links (LinkedIn, email, website) sit on their letter; no link is nested inside another.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const results = [];
const test = (name, fn) => {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
};

// -- collect references -------------------------------------------------------
const refs = [];
for (const m of html.matchAll(/\s(?:href|src)\s*=\s*"([^"]*)"/g)) refs.push(m[1]);
for (const m of html.matchAll(/\ssrcset\s*=\s*"([^"]*)"/g))
  m[1].split(',').forEach(part => refs.push(part.trim().split(/\s+/)[0]));
const isLocal = u => u && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
const local = [...new Set(refs.filter(isLocal).map(u => decodeURI(u.split(/[?#]/)[0])))];

test('index.html has local references to check', () => assert.ok(local.length > 10, `only ${local.length}`));

test('every local href/src/srcset resolves to an existing file', () => {
  const missing = local.filter(u => {
    const p = path.join(ROOT, u);
    if (!fs.existsSync(p)) return true;
    return fs.statSync(p).isDirectory() && !fs.existsSync(path.join(p, 'index.html'));
  });
  assert.deepStrictEqual(missing, [], `missing: ${missing.join(', ')}`);
});

// -- docs ---------------------------------------------------------------------
const docs = fs.readdirSync(path.join(ROOT, 'docs')).filter(f => !f.startsWith('.')).sort();

test('every docs/*.pdf is linked at its current path', () => {
  const pdfs = docs.filter(f => f.endsWith('.pdf'));
  assert.ok(pdfs.length >= 6, `expected at least 6 PDFs, found ${pdfs.length}`);
  const unlinked = pdfs.filter(f => !refs.includes(`docs/${f}`));
  assert.deepStrictEqual(unlinked, [], `not linked: ${unlinked.join(', ')}`);
});

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}
const base = ['main', 'origin/main'].find(b => {
  try { git(['rev-parse', '--verify', '-q', b]); return true; } catch { return false; }
});
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

test('a main branch exists to compare docs/ against', () => assert.ok(base, 'neither main nor origin/main found'));

if (base) {
  test(`docs/ holds exactly the files it holds on ${base}`, () => {
    const onMain = git(['ls-tree', '--name-only', `${base}:docs`]).toString().trim().split('\n').sort();
    assert.deepStrictEqual(docs, onMain);
  });
  test(`every docs/ file is byte-identical to ${base} (sha256)`, () => {
    const changed = docs.filter(f =>
      sha(fs.readFileSync(path.join(ROOT, 'docs', f))) !== sha(git(['show', `${base}:docs/${f}`])));
    assert.deepStrictEqual(changed, [], `changed: ${changed.join(', ')}`);
  });
}

// -- the turning hero -----------------------------------------------------------
test('every assets/turn/pose-*.webp is referenced by index.html', () => {
  const poses = fs.readdirSync(path.join(ROOT, 'assets/turn')).filter(f => /^pose-\d+\.webp$/.test(f)).sort();
  assert.deepStrictEqual(poses, ['pose-1.webp', 'pose-3.webp', 'pose-4.webp', 'pose-5.webp', 'pose-6.webp']);
  const unref = poses.filter(f => !local.includes(`assets/turn/${f}`));
  assert.deepStrictEqual(unref, [], `not referenced: ${unref.join(', ')}`);
});
test('the front pose (1) is the one shown without JS', () => {
  assert.match(html, /<img data-pose="1" src="assets\/turn\/pose-1\.webp"[^>]*class="on"/);
});
const js = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
test('the turn is driven by scroll, not the pointer or the phone', () => {
  for (const banned of ['deviceorientation', 'DeviceOrientationEvent', 'requestPermission', 'idleT'])
    assert.ok(!js.includes(banned), `script.js still has ${banned}`);
  assert.ok(!/class="tilt"/.test(html), 'the tap-to-tilt button is still in index.html');
  assert.match(js, /addEventListener\('scroll'/);
});
test('the turn sequence starts and ends on the front pose and visits every pose', () => {
  const m = js.match(/const SEQ = (\[.*?\]);/);
  assert.ok(m, 'SEQ not found in script.js');
  const seq = JSON.parse(m[1].replace(/'/g, '"').replace(/(\d)?\.(\d)/g, (_, a, b) => `${a || 0}.${b}`));
  const poses = seq.map(([, p]) => p);
  assert.strictEqual(poses[0], '1'); assert.strictEqual(poses.at(-1), '1'); assert.strictEqual(seq[0][0], 0);
  assert.deepStrictEqual([...new Set(poses)].sort(), ['1', '3', '4', '5', '6']);
});
test('every file in assets/ is used by the page (or is the og image)', () => {
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.startsWith('.') ? [] : [`${d}/${e.name}`]);
  // fonts: used if fonts.css references them; OFL/licence texts ship with the fonts on purpose
  const fontsCss = fs.existsSync(path.join(ROOT, 'assets/fonts/fonts.css')) ? fs.readFileSync(path.join(ROOT, 'assets/fonts/fonts.css'), 'utf8') : '';
  const unused = walk('assets').filter(f => !local.includes(f) && !html.includes(f)
    && !(f.startsWith('assets/fonts/') && (fontsCss.includes(path.basename(f)) || /^OFL-.*\.txt$/.test(path.basename(f)))));
  assert.deepStrictEqual(unused, [], `unused: ${unused.join(', ')}`);
});

test('every font in assets/fonts/fonts.css exists and is open-licence', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/fonts/fonts.css'), 'utf8');
  for (const [, f] of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(ROOT, 'assets/fonts', f)), `missing font ${f}`);
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'page still calls Google Fonts');
});

// -- removed files --------------------------------------------------------------
const removed = ['grain.js', 'test/theme.test.js'];
test('removed files are gone and nothing references them', () => {
  for (const f of removed) assert.ok(!fs.existsSync(path.join(ROOT, f)), `${f} still exists`);
  const texts = ['index.html', 'style.css', 'script.js', 'package.json']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const f of [...removed, 'grain', 'theme.test', 'fast-check', 'design/assets/', 'portrait-cutout', 'polaroid-16', 'assets/face.jpg', 'cover-cv-ignacio-balasch-1.png'])
    assert.ok(!texts.includes(f), `still referenced: ${f}`);
});

test('surname is spelled Solá', () => {
  assert.ok(html.includes('Balasch Solá'));
  assert.ok(!/Sol[àa]\b/.test(html.replace(/Solá/g, '')), 'found Solà or Sola');
});

// -- referees ------------------------------------------------------------------
const REFEREES = {
  'rec-baldo-lopez-hernandez-2025': ['https://www.linkedin.com/in/baldolopezhernandez/', 'mailto:baldolh@amazon.es'],
  'rec-kate-dobrokhotova-2025': ['https://www.linkedin.com/in/ekaterina-dobrokhotova-5939a968/', 'mailto:dobrokhe@amazon.es'],
  'rec-sara-lumbreras-2025': ['https://www.linkedin.com/in/sara-lumbreras-04889316/', 'https://www.iit.comillas.edu/people/slumbreras', 'mailto:slumbreras@comillas.edu'],
};
test("every referee's links sit on their own letter", () => {
  for (const [doc, links] of Object.entries(REFEREES)) {
    const m = html.match(new RegExp(`<div class="obj letter"[^>]*>\\s*<a class="open" href="docs/${doc}\\.pdf"[\\s\\S]*?<p class="ln">([\\s\\S]*?)</p>`));
    assert.ok(m, `letter ${doc} has no .ln links`);
    for (const l of links) assert.ok(m[1].includes(`href="${l}"`), `${doc}: missing ${l}`);
  }
});
test('no link is nested inside another link', () => {
  let depth = 0;
  for (const m of html.matchAll(/<(\/?)a[\s>]/g)) {
    depth += m[1] ? -1 : 1;
    assert.ok(depth <= 1, `nested <a> near offset ${m.index}`);
  }
  assert.strictEqual(depth, 0);
});

// -- report ---------------------------------------------------------------------
for (const [s, n, e] of results) console.log(`${s === 'ok' ? 'ok  ' : 'FAIL'} ${n}${e ? `\n     ${e}` : ''}`);
const failed = results.filter(r => r[0] !== 'ok').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
