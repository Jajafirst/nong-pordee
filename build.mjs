// Bundles the React app into one self-contained HTML file (React is inlined, nothing loads from a CDN).
import { context } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
const ctx = await context({ entryPoints: ['src/main.jsx'], bundle: true, minify: true, format: 'iife', jsx: 'automatic', write: false, target: 'es2020', loader: { '.json': 'json' }, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
async function write() {
  const out = await ctx.rebuild();
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync('src/styles.css', 'utf8');
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>น้องพอดี AI · คาดการณ์ให้แม่น สั่งให้พอดี</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Prompt:wght@500;600&display=swap">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log('built dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
}
await write();
if (process.argv.includes('--serve')) {
  let t;
  watch('src', { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => write().catch(e => console.error(e.message)), 150); });
  createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(readFileSync('dist/index.html')); }).listen(5174, () => console.log('Open http://localhost:5174  (rebuilds when you save a file in src/)'));
} else { await ctx.dispose(); }
