import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Normal build: everything bundled, works on any static host (GitHub Pages).
// ARTIFACT=1 build: for claude.ai hosting, which only allows a few CDNs.
// Libraries and fonts load from those CDNs; our code and data stay local.
const artifact = process.env.ARTIFACT === '1';

const cdnTags = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..900,0..100,0..1;1,9..144,300..900,0..100,0..1&family=DM+Mono:wght@400;500&display=swap" />`;

export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, outDir: artifact ? 'dist-artifact' : 'dist' },
  resolve: {
    alias: artifact
      ? [
          { find: /^@fontsource(-variable)?\/.*$/, replacement: here('./src/artifact/empty.css') },
        ]
      : [],
  },
  plugins: artifact
    ? [{ name: 'cdn-tags', transformIndexHtml: (html) => html.replace('</head>', `${cdnTags}\n  </head>`) }]
    : [],
});
