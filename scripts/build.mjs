import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await build({ entryPoints: ['src/app.tsx'], bundle: true, minify: true, sourcemap: false, outfile: 'assets/app.js', target: 'es2020', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'styles.css', 'config.js'].map(file => copyFile(file, `dist/${file}`)));
await cp('assets', 'dist/assets', { recursive: true });
console.log('Compilación lista: index.html para Live Server; dist/ para Netlify.');
