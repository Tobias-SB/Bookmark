// Rebuilds the two javascript: links in index.html from bookmarklet.js. Run: node tools/spike-s3/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, 'bookmarklet.js'), 'utf8');

function wrap(mode) {
  const code = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .join(' ')
    .replace('__MODE__', mode);
  try {
    new Function(code);
  } catch (error) {
    throw new Error(`Generated ${mode} bookmarklet has a syntax error: ${error.message}`);
  }
  return `javascript:${encodeURIComponent(code).replace(/'/g, '%27')}`;
}

const htmlPath = join(dir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
for (const mode of ['capture', 'count']) {
  const pattern = new RegExp(`(id="link-${mode}" href=")[^"]*(")`);
  if (!pattern.test(html)) throw new Error(`index.html has no link-${mode} anchor.`);
  html = html.replace(pattern, (_m, a, b) => `${a}${wrap(mode)}${b}`);
}
writeFileSync(htmlPath, html);
