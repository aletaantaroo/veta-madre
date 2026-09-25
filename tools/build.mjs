// Empaqueta el proyecto por módulos en un único HTML (para el artifact y para abrirlo sin servidor).
import fs from 'fs';
import * as esbuild from 'esbuild';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const js = await esbuild.build({entryPoints: [ROOT + '/js/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none'});
const cssSrc = ['base', 'hud', 'windows', 'overlays', 'descenso', 'city'].map(n => fs.readFileSync(`${ROOT}/css/${n}.css`, 'utf8')).join('\n');
const css = (await esbuild.transform(cssSrc, {loader: 'css', minify: true})).code;
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const body = html.split('<!--APP-START-->')[1].split('<!--APP-END-->')[0].replace(/\n\s+/g, '\n');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap">';
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = `<title>Veta Madre</title>\n${fonts}\n<style>${css}</style>\n${body}\n<script>${code}</script>\n`;
fs.mkdirSync(ROOT + '/dist', {recursive: true});
fs.writeFileSync(ROOT + '/dist/artifact.html', page);
const full = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#2a1a0e">\n${page.replace('\n' + fonts, '\n' + fonts).split(body)[0]}</head>\n<body>\n${body}\n<script>${code}</script>\n</body>\n</html>\n`;
fs.writeFileSync(ROOT + '/dist/veta-madre.html', full);
console.log('artifact', (page.length/1024).toFixed(1) + ' KB', '· js', (code.length/1024).toFixed(1) + ' KB', '· css', (css.length/1024).toFixed(1) + ' KB');
