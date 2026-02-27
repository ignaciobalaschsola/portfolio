/**
 * Theme & Font Update — Test Helpers and Smoke Tests
 *
 * Provides CSS/HTML parsing utilities and WCAG contrast helpers
 * used by property-based and unit tests in subsequent tasks.
 *
 * Run: node test/theme.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const fc = require('fast-check');

// ---------------------------------------------------------------------------
// File contents (read once)
// ---------------------------------------------------------------------------
const CSS_PATH = path.join(__dirname, '..', 'style.css');
const HTML_PATH = path.join(__dirname, '..', 'index.html');

const css = fs.readFileSync(CSS_PATH, 'utf-8');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// Helpers — Media-query block extraction (brace-counting approach)
// ---------------------------------------------------------------------------

/**
 * Extract the full content between the outermost braces of a
 * `@media (prefers-color-scheme: <scheme>)` block.
 * Uses brace counting to handle nested braces correctly.
 */
function _extractMediaBlock(css, scheme) {
  const tag = `@media (prefers-color-scheme: ${scheme})`;
  const idx = css.indexOf(tag);
  if (idx === -1) return null;

  // Find the opening brace of the media block
  const openBrace = css.indexOf('{', idx);
  if (openBrace === -1) return null;

  let depth = 1;
  let i = openBrace + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }

  // i now points one past the closing brace
  return css.slice(openBrace + 1, i - 1);
}

/**
 * Parse CSS custom properties (--name: value) from a CSS text block.
 * Returns an object like { '--bg': '#0E1116', '--text': '#E6E6E6', ... }
 */
function _parseCustomProperties(block) {
  if (!block) return {};
  const props = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    props[m[1]] = m[2].trim();
  }
  return props;
}

// ---------------------------------------------------------------------------
// Helpers — Theme parsers
// ---------------------------------------------------------------------------

/**
 * parseBareRoot(css) — extracts custom properties from the bare `:root { … }`
 * block that is NOT inside any @media query.
 *
 * Strategy: find every `:root` block, then exclude those whose position falls
 * inside a media query block.
 */
function parseBareRoot(cssText) {
  // First, identify the ranges of all @media blocks
  const mediaRanges = [];
  const mediaRe = /@media\s*\([^)]*\)\s*\{/g;
  let mm;
  while ((mm = mediaRe.exec(cssText)) !== null) {
    const start = mm.index;
    const openBrace = cssText.indexOf('{', start);
    let depth = 1;
    let j = openBrace + 1;
    while (j < cssText.length && depth > 0) {
      if (cssText[j] === '{') depth++;
      else if (cssText[j] === '}') depth--;
      j++;
    }
    mediaRanges.push({ start, end: j });
  }

  function isInsideMedia(pos) {
    return mediaRanges.some((r) => pos >= r.start && pos < r.end);
  }

  // Now find all :root blocks
  const rootRe = /:root\s*\{/g;
  let rm;
  while ((rm = rootRe.exec(cssText)) !== null) {
    if (isInsideMedia(rm.index)) continue; // skip :root inside @media

    const openBrace = cssText.indexOf('{', rm.index);
    let depth = 1;
    let j = openBrace + 1;
    while (j < cssText.length && depth > 0) {
      if (cssText[j] === '{') depth++;
      else if (cssText[j] === '}') depth--;
      j++;
    }
    const block = cssText.slice(openBrace + 1, j - 1);
    return _parseCustomProperties(block);
  }

  return {};
}

/**
 * parseDarkTheme(css) — extracts custom properties from
 * `@media (prefers-color-scheme: dark) { :root { … } }`
 */
function parseDarkTheme(cssText) {
  const block = _extractMediaBlock(cssText, 'dark');
  if (!block) return {};
  // Find :root inside the media block
  const rootMatch = block.match(/:root\s*\{/);
  if (!rootMatch) return {};
  const openBrace = block.indexOf('{', rootMatch.index);
  let depth = 1;
  let j = openBrace + 1;
  while (j < block.length && depth > 0) {
    if (block[j] === '{') depth++;
    else if (block[j] === '}') depth--;
    j++;
  }
  const rootBlock = block.slice(openBrace + 1, j - 1);
  return _parseCustomProperties(rootBlock);
}

/**
 * parseLightTheme(css) — extracts custom properties from
 * `@media (prefers-color-scheme: light) { :root { … } }`
 */
function parseLightTheme(cssText) {
  const block = _extractMediaBlock(cssText, 'light');
  if (!block) return {};
  const rootMatch = block.match(/:root\s*\{/);
  if (!rootMatch) return {};
  const openBrace = block.indexOf('{', rootMatch.index);
  let depth = 1;
  let j = openBrace + 1;
  while (j < block.length && depth > 0) {
    if (block[j] === '{') depth++;
    else if (block[j] === '}') depth--;
    j++;
  }
  const rootBlock = block.slice(openBrace + 1, j - 1);
  return _parseCustomProperties(rootBlock);
}

/**
 * parseDarkMediaBlock(css) — returns the full text content of the
 * `@media (prefers-color-scheme: dark)` block (including non-:root rules).
 */
function parseDarkMediaBlock(cssText) {
  return _extractMediaBlock(cssText, 'dark');
}

/**
 * parseLightMediaBlock(css) — returns the full text content of the
 * `@media (prefers-color-scheme: light)` block (including non-:root rules).
 */
function parseLightMediaBlock(cssText) {
  return _extractMediaBlock(cssText, 'light');
}

// ---------------------------------------------------------------------------
// Helpers — Color & WCAG contrast
// ---------------------------------------------------------------------------

/**
 * hexToRgb(hex) — converts a hex color string to { r, g, b }.
 * Supports 3-char (#abc) and 6-char (#aabbcc) hex, with or without '#'.
 */
function hexToRgb(hex) {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * relativeLuminance(r, g, b) — WCAG 2.x relative luminance.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * contrastRatio(hex1, hex2) — WCAG contrast ratio between two hex colors.
 * Returns a value >= 1.
 */
function contrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Helpers — HTML parsing
// ---------------------------------------------------------------------------

/**
 * getGoogleFontsUrl(html) — extracts the Google Fonts stylesheet URL
 * from the <link> tag in index.html. Returns the URL string or null.
 */
function getGoogleFontsUrl(htmlText) {
  const match = htmlText.match(
    /<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["']/
  );
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Exports (for use in subsequent test tasks within the same file)
// ---------------------------------------------------------------------------

module.exports = {
  css,
  html,
  parseBareRoot,
  parseDarkTheme,
  parseLightTheme,
  parseDarkMediaBlock,
  parseLightMediaBlock,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  getGoogleFontsUrl,
};


// ===========================================================================
// Smoke tests — verify helpers work correctly
// ===========================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n=== Smoke Tests: Parsing Helpers ===\n');

// --- parseBareRoot ---
test('parseBareRoot returns --bg', () => {
  const root = parseBareRoot(css);
  assert.ok(root['--bg'], 'Expected --bg to be defined in bare :root');
});

test('parseBareRoot returns all 7 color properties', () => {
  const root = parseBareRoot(css);
  const required = ['--bg', '--surface', '--border', '--accent', '--text', '--text-dim', '--text-meta'];
  for (const prop of required) {
    assert.ok(root[prop], `Expected ${prop} in bare :root`);
  }
});

test('parseBareRoot includes font variables', () => {
  const root = parseBareRoot(css);
  assert.ok(root['--font-heading'] || root['--font-serif'], 'Expected heading font variable in bare :root');
  assert.ok(root['--font-sans'], 'Expected --font-sans in bare :root');
  assert.ok(root['--font-mono'], 'Expected --font-mono in bare :root');
});

test('parseBareRoot does NOT pick up light theme values', () => {
  const root = parseBareRoot(css);
  assert.notStrictEqual(root['--bg'], '#FAFAFA', 'Bare :root --bg should not be the light value');
});

// --- parseDarkTheme ---
test('parseDarkTheme returns --bg', () => {
  const dark = parseDarkTheme(css);
  assert.ok(dark['--bg'], 'Expected --bg in dark theme');
});

test('parseDarkTheme returns all 7 color properties', () => {
  const dark = parseDarkTheme(css);
  const required = ['--bg', '--surface', '--border', '--accent', '--text', '--text-dim', '--text-meta'];
  for (const prop of required) {
    assert.ok(dark[prop], `Expected ${prop} in dark theme`);
  }
});

test('parseDarkTheme does NOT include font variables', () => {
  const dark = parseDarkTheme(css);
  assert.strictEqual(dark['--font-sans'], undefined, 'Dark theme should not define --font-sans');
});

// --- parseLightTheme ---
test('parseLightTheme returns --bg', () => {
  const light = parseLightTheme(css);
  assert.ok(light['--bg'], 'Expected --bg in light theme');
});

test('parseLightTheme returns all 7 color properties', () => {
  const light = parseLightTheme(css);
  const required = ['--bg', '--surface', '--border', '--accent', '--text', '--text-dim', '--text-meta'];
  for (const prop of required) {
    assert.ok(light[prop], `Expected ${prop} in light theme`);
  }
});

test('parseLightTheme --bg is the light value', () => {
  const light = parseLightTheme(css);
  assert.strictEqual(light['--bg'], '#FAFAFA', 'Light theme --bg should be #FAFAFA');
});

// --- Media block parsers ---
test('parseLightMediaBlock includes .doc-card:hover rule', () => {
  const block = parseLightMediaBlock(css);
  assert.ok(block, 'Light media block should exist');
  assert.ok(block.includes('.doc-card:hover'), 'Light media block should contain .doc-card:hover');
});

test('parseLightMediaBlock includes #grain rule', () => {
  const block = parseLightMediaBlock(css);
  assert.ok(block.includes('#grain'), 'Light media block should contain #grain');
});

test('parseDarkMediaBlock exists', () => {
  const block = parseDarkMediaBlock(css);
  assert.ok(block, 'Dark media block should exist');
});

// --- hexToRgb ---
test('hexToRgb parses 6-char hex', () => {
  const rgb = hexToRgb('#FF8800');
  assert.deepStrictEqual(rgb, { r: 255, g: 136, b: 0 });
});

test('hexToRgb parses 3-char hex', () => {
  const rgb = hexToRgb('#F80');
  assert.deepStrictEqual(rgb, { r: 255, g: 136, b: 0 });
});

test('hexToRgb handles no hash prefix', () => {
  const rgb = hexToRgb('0E1116');
  assert.deepStrictEqual(rgb, { r: 14, g: 17, b: 22 });
});

// --- relativeLuminance ---
test('relativeLuminance of white is ~1', () => {
  const l = relativeLuminance(255, 255, 255);
  assert.ok(Math.abs(l - 1) < 0.001, `Expected ~1, got ${l}`);
});

test('relativeLuminance of black is 0', () => {
  const l = relativeLuminance(0, 0, 0);
  assert.strictEqual(l, 0);
});

// --- contrastRatio ---
test('contrastRatio of black vs white is 21', () => {
  const ratio = contrastRatio('#000000', '#FFFFFF');
  assert.ok(Math.abs(ratio - 21) < 0.1, `Expected ~21, got ${ratio}`);
});

test('contrastRatio of same color is 1', () => {
  const ratio = contrastRatio('#3E8E7E', '#3E8E7E');
  assert.ok(Math.abs(ratio - 1) < 0.001, `Expected 1, got ${ratio}`);
});

// --- getGoogleFontsUrl ---
test('getGoogleFontsUrl extracts the URL', () => {
  const url = getGoogleFontsUrl(html);
  assert.ok(url, 'Expected a Google Fonts URL');
  assert.ok(url.includes('fonts.googleapis.com'), 'URL should be from Google Fonts');
});

test('getGoogleFontsUrl URL includes Roboto', () => {
  const url = getGoogleFontsUrl(html);
  assert.ok(url.includes('Roboto'), 'Google Fonts URL should include Roboto');
});

// ===========================================================================
// Property Test 1: Theme text contrast meets accessibility threshold
// Feature: theme-and-font-update, Property 1
// ===========================================================================

console.log('\n=== Property Test 1: Theme text contrast ===\n');

test('Property 1: All text/bg pairs meet WCAG 4.5:1 contrast in every theme', () => {
  /**
   * Validates: Requirements 1.5, 2.5
   *
   * For any theme (dark, light, or fallback) and for any text custom property
   * (--text, --text-dim, --text-meta) paired with that theme's --bg value,
   * the WCAG contrast ratio must be at least 4.5:1.
   */
  const themes = [
    { name: 'fallback', props: parseBareRoot(css) },
    { name: 'dark', props: parseDarkTheme(css) },
    { name: 'light', props: parseLightTheme(css) },
  ];
  const textProps = ['--text', '--text-dim', '--text-meta'];

  fc.assert(
    fc.property(
      fc.constantFrom(...themes),
      fc.constantFrom(...textProps),
      (theme, textProp) => {
        const bg = theme.props['--bg'];
        const fg = theme.props[textProp];
        assert.ok(bg, `${theme.name} missing --bg`);
        assert.ok(fg, `${theme.name} missing ${textProp}`);
        const ratio = contrastRatio(fg, bg);
        assert.ok(
          ratio >= 4.5,
          `${theme.name} ${textProp} (${fg}) vs --bg (${bg}): contrast ${ratio.toFixed(2)} < 4.5`
        );
      }
    ),
    { numRuns: 100 }
  );
});

// ===========================================================================
// Property Test 2: All theme blocks define the complete set of custom properties
// Feature: theme-and-font-update, Property 2
// ===========================================================================

console.log('\n=== Property Test 2: Theme block completeness ===\n');

test('Property 2: Every theme block contains all 7 required custom properties', () => {
  /**
   * Validates: Requirements 1.1, 2.1, 3.2
   *
   * For each theme block (bare :root fallback, prefers-color-scheme: dark,
   * prefers-color-scheme: light), the block shall define all seven required
   * custom properties: --bg, --surface, --border, --accent, --text, --text-dim, --text-meta.
   */
  const requiredProps = ['--bg', '--surface', '--border', '--accent', '--text', '--text-dim', '--text-meta'];
  const themes = [
    { name: 'fallback', props: parseBareRoot(css) },
    { name: 'dark', props: parseDarkTheme(css) },
    { name: 'light', props: parseLightTheme(css) },
  ];

  fc.assert(
    fc.property(
      fc.constantFrom(...themes),
      fc.subarray(requiredProps, { minLength: 1 }),
      (theme, subset) => {
        for (const prop of subset) {
          assert.ok(
            theme.props[prop] !== undefined,
            `${theme.name} theme is missing ${prop}`
          );
        }
      }
    ),
    { numRuns: 100 }
  );
});

// ===========================================================================
// Property Test 3: Fallback values equal dark theme values
// Feature: theme-and-font-update, Property 3
// ===========================================================================

console.log('\n=== Property Test 3: Fallback-dark equivalence ===\n');

test('Property 3: Bare :root fallback color values match dark theme values', () => {
  /**
   * Validates: Requirements 3.1, 3.3
   *
   * For each custom property in the bare :root fallback, its value shall be
   * identical to the corresponding value defined in the @media
   * (prefers-color-scheme: dark) block.
   */
  const colorProps = ['--bg', '--surface', '--border', '--accent', '--text', '--text-dim', '--text-meta'];
  const fallback = parseBareRoot(css);
  const dark = parseDarkTheme(css);

  fc.assert(
    fc.property(
      fc.constantFrom(...colorProps),
      (prop) => {
        assert.strictEqual(
          fallback[prop],
          dark[prop],
          `Fallback ${prop} (${fallback[prop]}) !== dark ${prop} (${dark[prop]})`
        );
      }
    ),
    { numRuns: 100 }
  );
});

// ===========================================================================
// Unit Tests: Structural and font checks
// ===========================================================================

console.log('\n=== Unit Tests: Structural & Font Checks ===\n');

// --- Google Fonts URL ---
test('Google Fonts URL includes Roboto (Req 6.2)', () => {
  const url = getGoogleFontsUrl(html);
  assert.ok(url.includes('Roboto'), 'Google Fonts URL should include Roboto');
});

test('Google Fonts URL excludes DM Serif Display (Req 6.3)', () => {
  const url = getGoogleFontsUrl(html);
  assert.ok(!url.includes('DM+Serif+Display'), 'Google Fonts URL should not include DM Serif Display');
  assert.ok(!url.includes('DM%20Serif'), 'Google Fonts URL should not include DM Serif (encoded)');
});

// --- Font variable ---
test('--font-heading references Roboto (Req 6.4)', () => {
  const root = parseBareRoot(css);
  const fontHeading = root['--font-heading'];
  assert.ok(fontHeading, '--font-heading should be defined');
  assert.ok(fontHeading.includes('Roboto'), `--font-heading should reference Roboto, got: ${fontHeading}`);
});

// --- .identity h1 ---
test('.identity h1 does not reference DM Serif Display (Req 6.1)', () => {
  assert.ok(!css.includes("'DM Serif Display'"), 'CSS should not contain DM Serif Display');
  assert.ok(!css.includes('"DM Serif Display"'), 'CSS should not contain DM Serif Display');
  // Verify h1 uses --font-heading
  const h1Match = css.match(/\.identity\s+h1\s*\{[^}]*font-family:\s*var\(--font-heading\)/s);
  assert.ok(h1Match, '.identity h1 should use var(--font-heading)');
});

// --- Light mode shadow opacity < dark mode (Req 4.1) ---
test('Light mode .doc-card:hover shadow is softer than dark mode (Req 4.1)', () => {
  const lightBlock = parseLightMediaBlock(css);
  assert.ok(lightBlock, 'Light media block should exist');
  
  // Extract shadow opacity from light block
  const lightShadowMatch = lightBlock.match(/box-shadow:[^;]*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/);
  assert.ok(lightShadowMatch, 'Light .doc-card:hover should have a shadow with rgba');
  const lightOpacity = parseFloat(lightShadowMatch[1]);
  
  // Extract shadow opacity from base .doc-card:hover (outside media queries)
  // The base rule appears after the media query blocks in the file
  // Find it by matching all occurrences and taking the one from outside the light block
  const allShadows = [...css.matchAll(/\.doc-card:hover\s*\{[^}]*box-shadow:[^;]*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/gs)];
  // Filter to the one NOT inside the light media block
  const baseShadow = allShadows.find(m => !lightBlock.includes(m[0]));
  assert.ok(baseShadow, 'Base .doc-card:hover should have a shadow with rgba');
  const darkOpacity = parseFloat(baseShadow[1]);
  
  assert.ok(lightOpacity < darkOpacity, `Light shadow opacity (${lightOpacity}) should be less than dark (${darkOpacity})`);
});

// --- Light mode hover border differs from dark (Req 4.2) ---
test('Light mode hover border color differs from dark mode (Req 4.2)', () => {
  const lightBlock = parseLightMediaBlock(css);
  const lightBorderMatch = lightBlock.match(/border-color:\s*(#[0-9A-Fa-f]+)/);
  assert.ok(lightBorderMatch, 'Light .doc-card:hover should have a border-color');
  
  // Find base .doc-card:hover border-color outside the light media block
  const allBorders = [...css.matchAll(/\.doc-card:hover\s*\{[^}]*border-color:\s*(#[0-9A-Fa-f]+)/gs)];
  const baseBorder = allBorders.find(m => !lightBlock.includes(m[0]));
  assert.ok(baseBorder, 'Base .doc-card:hover should have a border-color');
  
  assert.notStrictEqual(
    lightBorderMatch[1].toLowerCase(),
    baseBorder[1].toLowerCase(),
    'Light and dark hover border colors should differ'
  );
});

// --- Grain opacity in light < dark (Req 5.1) ---
test('#grain opacity in light mode is less than dark mode (Req 5.1)', () => {
  const lightBlock = parseLightMediaBlock(css);
  const lightGrainMatch = lightBlock.match(/#grain\s*\{[^}]*opacity:\s*([\d.]+)/s);
  assert.ok(lightGrainMatch, 'Light media block should have #grain opacity');
  const lightOpacity = parseFloat(lightGrainMatch[1]);
  
  // Base #grain opacity — find the one outside the light media block
  const allGrain = [...css.matchAll(/#grain\s*\{[^}]*opacity:\s*([\d.]+)/gs)];
  const baseGrain = allGrain.find(m => !lightBlock.includes(m[0]));
  assert.ok(baseGrain, 'Base #grain should have opacity');
  const baseOpacity = parseFloat(baseGrain[1]);
  
  assert.ok(lightOpacity < baseOpacity, `Light grain opacity (${lightOpacity}) should be less than base (${baseOpacity})`);
});

// --- No prefers-color-scheme in grain.js (Req 7.3) ---
test('grain.js has no prefers-color-scheme logic (Req 7.3)', () => {
  const grainJs = fs.readFileSync(path.join(__dirname, '..', 'grain.js'), 'utf-8');
  assert.ok(!grainJs.includes('prefers-color-scheme'), 'grain.js should not contain prefers-color-scheme');
  assert.ok(!grainJs.includes('matchMedia'), 'grain.js should not contain matchMedia for theme detection');
});

// --- Accent contrast in light mode (Req 2.6) ---
test('Light theme --accent vs --bg meets 4.5:1 contrast (Req 2.6)', () => {
  const light = parseLightTheme(css);
  const ratio = contrastRatio(light['--accent'], light['--bg']);
  assert.ok(ratio >= 4.5, `Light --accent vs --bg contrast is ${ratio.toFixed(2)}, expected >= 4.5`);
});

// --- Summary ---
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
