/* Bundle SingCoach into self-contained single-file builds.
 *
 * Outputs:
 *   dist/singcoach-standalone.html — complete page; double-click it or drop
 *     it on any static host and it just works (no server, no dependencies).
 *   dist/artifact.html — body-only variant (no doctype/html/head/body) for
 *     hosts that wrap content in their own page skeleton.
 *
 * Usage: node tools/build-single.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let html = read('index.html');

// Inline the stylesheet.
html = html.replace(
  /<link rel="stylesheet" href="css\/styles\.css">/,
  () => '<style>\n' + read('css/styles.css') + '\n</style>'
);

// Inline every local script, preserving order.
html = html.replace(
  /<script src="(js\/[\w.-]+\.js)"><\/script>/g,
  (m, src) => '<script>\n' + read(src) + '\n</script>'
);

if (/<(script src=|link rel="stylesheet")/.test(html)) {
  console.error('build-single: some local assets were not inlined');
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'singcoach-standalone.html'), html);

// Body-only variant: strip the document shell, keep title/style inline.
const title = '<title>SingCoach — Learn to Sing</title>\n';
const inner = html
  .replace(/^[\s\S]*?<head>/, '')
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<!DOCTYPE html>|<meta charset="UTF-8">|<meta name="viewport"[^>]*>/g, '')
  .replace(/<link rel="icon"[^>]*>/, '')
  .replace(/<title>[^<]*<\/title>/, '');
fs.writeFileSync(path.join(DIST, 'artifact.html'), title + inner.trim() + '\n');

const kb = (fs.statSync(path.join(DIST, 'singcoach-standalone.html')).size / 1024).toFixed(1);
console.log(`built dist/singcoach-standalone.html (${kb} KB) and dist/artifact.html`);
