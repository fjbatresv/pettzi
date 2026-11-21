import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const source = 'apps/landing';
const output = 'dist/landing';
const files = [
  'index.html',
  'styles.css',
  'main.js',
  'logo.svg',
  'logo-mark.svg',
  'og-image.png',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'es/index.html',
];
const assets = [
  'styles.css',
  'main.js',
  'logo.svg',
  'logo-mark.svg',
  'og-image.png',
];

await mkdir(join(output, 'es'), { recursive: true });
for (const file of files)
  await copyFile(join(source, file), join(output, file));

const versions = Object.fromEntries(
  await Promise.all(
    assets.map(async (file) => [
      file,
      createHash('sha256')
        .update(await readFile(join(output, file)))
        .digest('hex')
        .slice(0, 8),
    ]),
  ),
);

for (const file of ['index.html', 'es/index.html', '404.html']) {
  const path = join(output, file);
  let html = await readFile(path, 'utf8');
  html = html.replace(
    /\b(href|src)="([^"?#]+\.(?:css|js|svg|png))"/gi,
    (reference, attribute, url) => {
      const version = versions[basename(url)];
      return version ? `${attribute}="${url}?v=${version}"` : reference;
    },
  );
  html = html.replace(
    /(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")([^"]+)(")/gi,
    (reference, prefix, url, suffix) => {
      const version = versions[basename(url.split('?')[0])];
      return version ? `${prefix}${url}?v=${version}${suffix}` : reference;
    },
  );
  await writeFile(path, html);
}
