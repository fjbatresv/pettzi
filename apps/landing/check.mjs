import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pages = [
  ['dist/landing/index.html', 'en'],
  ['dist/landing/es/index.html', 'es'],
];

for (const [path, language] of pages) {
  const html = readFileSync(path, 'utf8');
  assert.match(html, new RegExp(`<html lang="${language}"`), `${path}: language`);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && title.length <= 60, `${path}: title length`);
  assert.ok(description && description.length >= 70 && description.length <= 160, `${path}: description length`);
  assert.match(html, /rel="canonical" href="https:\/\//, `${path}: canonical`);
  assert.match(html, /hreflang="x-default"/, `${path}: x-default`);
  assert.match(html, /property="og:image"/, `${path}: Open Graph image`);
  assert.match(html, /property="og:image:alt"/, `${path}: Open Graph image alt`);
  assert.match(html, /name="twitter:card" content="summary_large_image"/, `${path}: Twitter card`);
  assert.match(html, /application\/ld\+json/, `${path}: structured data`);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${path}: one h1`);
  assert.doesNotMatch(html, /<img(?![^>]*\balt=)/, `${path}: image alt text`);
  assert.doesNotMatch(html, /<img(?![^>]*\bwidth=)/, `${path}: image width`);
  assert.doesNotMatch(html, /<img(?![^>]*\bheight=)/, `${path}: image height`);
  const headingLevels = [...html.matchAll(/<h([1-6])\b/g)].map(([, level]) => Number(level));
  assert.ok(headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1] + 1), `${path}: heading hierarchy`);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('#')) {
      assert.ok(html.includes(`id="${href.slice(1)}"`), `${path}: anchor ${href}`);
    } else if (!/^(?:[a-z]+:|\/\/)/i.test(href)) {
      const target = resolve(dirname(path), decodeURIComponent(href.split('#')[0] || 'index.html'));
      assert.ok(existsSync(target), `${path}: local link ${href}`);
    }
  }
}

const image = readFileSync('dist/landing/og-image.png');
assert.equal(image.readUInt32BE(16), 1200, 'Open Graph image width');
assert.equal(image.readUInt32BE(20), 630, 'Open Graph image height');

const notFound = readFileSync('dist/landing/404.html', 'utf8');
assert.match(notFound, /name="robots" content="noindex"/);
assert.doesNotMatch(notFound, /rel="canonical"/);

const sitemap = readFileSync('dist/landing/sitemap.xml', 'utf8');
assert.match(sitemap, /<loc>https:\/\/fjbatresv\.github\.io\/pettzi\//);
assert.match(sitemap, /hreflang="es"/);
assert.match(readFileSync('dist/landing/robots.txt', 'utf8'), /Sitemap: https:\/\/fjbatresv\.github\.io\/pettzi\/sitemap\.xml/);
console.log('Landing SEO checks passed for EN, ES, and 404.');
