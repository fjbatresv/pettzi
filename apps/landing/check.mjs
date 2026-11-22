import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pages = [
  ['dist/landing/index.html', 'en'],
  ['dist/landing/es/index.html', 'es'],
];
const ids = [];
for (const [path, language] of pages) {
  const html = readFileSync(path, 'utf8');
  assert.match(
    html,
    new RegExp(`<html lang="${language}"`),
    `${path}: language`,
  );
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(
    /<meta\s+name="description"\s+content="([^"]+)"/,
  )?.[1];
  assert.ok(title && title.length <= 60, `${path}: title length`);
  assert.ok(
    description && description.length >= 70 && description.length <= 160,
    `${path}: description length`,
  );
  assert.match(html, /rel="canonical" href="https:\/\//, `${path}: canonical`);
  for (const locale of ['en', 'es', 'x-default'])
    assert.match(
      html,
      new RegExp(`hreflang="${locale}"`),
      `${path}: ${locale} alternate`,
    );
  assert.match(html, /og:image:alt/, `${path}: image alt`);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:title"/);
  assert.match(html, /name="twitter:description"/);
  assert.match(html, /name="twitter:image"/);
  assert.match(html, /"@graph"/);
  for (const type of [
    'WebSite',
    'WebPage',
    'Person',
    'SoftwareSourceCode',
    'BreadcrumbList',
  ])
    assert.match(
      html,
      new RegExp(`"@type"\\s*:\\s*"${type}"`),
      `${path}: JSON-LD ${type}`,
    );
  assert.match(
    html,
    /"url"\s*:\s*"https:\/\/fjbatresv\.com"/,
    `${path}: Person URL`,
  );
  assert.match(
    html,
    /"jobTitle"\s*:\s*"Solutions Architect and Senior Full Stack Engineer"/,
  );
  assert.match(html, /rel="preload"[^>]*as="font"[^>]*crossorigin/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${path}: one h1`);
  assert.doesNotMatch(html, /<img(?![^>]*\balt=)/, `${path}: img alt`);
  assert.doesNotMatch(html, /<img(?![^>]*\bwidth=)/, `${path}: img width`);
  assert.doesNotMatch(html, /<img(?![^>]*\bheight=)/, `${path}: img height`);
  const headingLevels = [...html.matchAll(/<h([1-6])\b/g)].map(([, level]) =>
    Number(level),
  );
  assert.ok(
    headingLevels.every(
      (level, index) => index === 0 || level <= headingLevels[index - 1] + 1,
    ),
    `${path}: heading order`,
  );
  const pageIds = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(
    ([, id]) => id,
  );
  for (const sectionId of ['architecture', 'monorepo'])
    assert.ok(pageIds.includes(sectionId), `${path}: ${sectionId} section`);
  ids.push(pageIds);
  for (const [, url] of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    if (
      !/^(?:[a-z]+:|\/\/|#)/i.test(url) &&
      /\.(?:css|js|svg|png)(?:[?#]|$)/i.test(url)
    )
      assert.match(
        url,
        /\?v=[a-f\d]{8}(?:#|$)/i,
        `${path}: versioned asset ${url}`,
      );
  }
  for (const [, candidates] of html.matchAll(/\bsrcset="([^"]+)"/gi))
    for (const candidate of candidates.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (/\.(?:css|js|svg|png)(?:[?#]|$)/i.test(url))
        assert.match(
          url,
          /\?v=[a-f\d]{8}(?:#|$)/i,
          `${path}: versioned srcset ${url}`,
        );
    }
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('#'))
      assert.ok(
        html.includes(`id="${href.slice(1)}"`),
        `${path}: anchor ${href}`,
      );
    else if (!/^(?:[a-z]+:|\/\/)/i.test(href))
      assert.ok(
        existsSync(
          resolve(
            dirname(path),
            decodeURIComponent(href.split(/[?#]/, 1)[0] || 'index.html'),
          ),
        ),
        `${path}: local link ${href}`,
      );
  }
}
assert.deepEqual(ids[0], ids[1], 'EN/ES section ID parity');
const image = readFileSync('dist/landing/og-image.png');
assert.equal(image.readUInt32BE(16), 1200, 'OG image width');
assert.equal(image.readUInt32BE(20), 630, 'OG image height');
assert.ok(
  statSync('dist/landing/og-image.png').size <= 100_000,
  'OG image under 100 KB',
);
for (const path of ['dist/landing/logo-1x.png', 'dist/landing/logo-2x.png'])
  assert.ok(statSync(path).size < 20_000, `${path}: logo below 20 KB`);
const logo2x = readFileSync('dist/landing/logo-2x.png');
assert.equal(logo2x.readUInt32BE(16), 64, 'Logo 2x width');
assert.equal(logo2x.readUInt32BE(20), 77, 'Logo 2x height');
const notFound = readFileSync('dist/landing/404.html', 'utf8');
assert.match(notFound, /name="robots" content="noindex"/);
assert.match(notFound, /lang="en"/);
assert.match(notFound, /Esta página no está aquí/);
assert.doesNotMatch(notFound, /rel="canonical"/);
const sitemap = readFileSync('dist/landing/sitemap.xml', 'utf8');
assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
assert.match(sitemap, /hreflang="es"/);
assert.match(
  readFileSync('dist/landing/robots.txt', 'utf8'),
  /Sitemap: https:\/\/fjbatresv\.github\.io\/pettzi\/sitemap\.xml/,
);
console.log('Landing SEO, metadata, locale parity, and asset checks passed.');
