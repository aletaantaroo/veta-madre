// Regenera los import/export de todos los módulos a partir de lo que cada uno declara y usa.
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import MagicString from 'magic-string';

const ROOT = process.argv[2] || new URL('../js', import.meta.url).pathname;
const files = [];
(function scan(d){ for (const f of fs.readdirSync(d).sort()){ const p = path.join(d, f); if (fs.statSync(p).isDirectory()) scan(p); else if (f.endsWith('.js')) files.push(p); } })(ROOT);

const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis).concat(['window','document','navigator','localStorage','sessionStorage','performance','requestAnimationFrame','cancelAnimationFrame','matchMedia','ResizeObserver','getComputedStyle','Intl','devicePixelRatio','addEventListener','removeEventListener','setTimeout','clearTimeout','setInterval','clearInterval','location','history','atob','btoa','escape','unescape','Image','Audio','AudioContext','webkitAudioContext','innerWidth','innerHeight','CustomEvent','Event','HTMLElement','DOMRect','Path2D','OffscreenCanvas','structuredClone','queueMicrotask','alert','confirm','console','fetch','URL','Blob','TextEncoder','TextDecoder','DecompressionStream','CompressionStream','CSS','visualViewport','CanvasRenderingContext2D','DOMMatrix']));

const mods = {};
for (const f of files){
  let code = fs.readFileSync(f, 'utf8');
  // quitar cabecera de imports generada y los export
  const sideFx = [];
  code = code.replace(/^(import [^\n]*\n)+\n?/, blk => { blk.split('\n').forEach(l => { if (/^import '[^']+';$/.test(l.trim())) sideFx.push(l.trim()); }); return ''; });
  code = code.replace(/(^|;[ \t]*)export (?=(async )?function|const |let |var |class )/gm, '$1');
  let ast;
  try { ast = acorn.parse(code, {ecmaVersion: 'latest', sourceType: 'module'}); }
  catch(e){ console.error('PARSE ERROR', path.relative(ROOT, f), e.message); process.exitCode = 1; continue; }
  const decl = new Map(); // name -> node
  const addPat = (p, node) => {
    if (!p) return;
    if (p.type === 'Identifier') decl.set(p.name, node);
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => addPat(q.type === 'RestElement' ? q.argument : q.value, node));
    else if (p.type === 'ArrayPattern') p.elements.forEach(q => addPat(q, node));
    else if (p.type === 'AssignmentPattern') addPat(p.left, node);
    else if (p.type === 'RestElement') addPat(p.argument, node);
  };
  const topStmts = [];
  for (const n of ast.body){
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') decl.set(n.id.name, n);
    else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => addPat(d.id, n));
    else if (n.type !== 'ImportDeclaration' && n.type !== 'EmptyStatement') topStmts.push(n);
  }
  const refs = new Set(), assigned = new Set(), local = new Set();
  // análisis de ámbitos: qué nombres declara cada función/bloque
  const scopes = new Map();
  const declIn = (node, name) => { if (!scopes.has(node)) scopes.set(node, new Set()); scopes.get(node).add(name); };
  const patNames = (p, out = []) => { if (!p) return out; if (p.type === 'Identifier') out.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out)); else if (p.type === 'ArrayPattern') p.elements.forEach(q => patNames(q, out)); else if (p.type === 'AssignmentPattern') patNames(p.left, out); else if (p.type === 'RestElement') patNames(p.argument, out); return out; };
  const isFn = n => /Function/.test(n.type);
  const isBlock = n => ['BlockStatement','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','Program','StaticBlock'].includes(n.type) || isFn(n);
  walk.fullAncestor(ast, (n, st, anc) => {
    if (n.type === 'VariableDeclarator'){
      const kind = anc[anc.length - 2].kind;
      for (let i = anc.length - 3; i >= 0; i--){ const a = anc[i]; if (kind === 'var' ? (isFn(a) || a.type === 'Program') : isBlock(a)){ patNames(n.id).forEach(x => declIn(a, x)); break; } }
    } else if (isFn(n)){
      n.params.forEach(p => patNames(p).forEach(x => declIn(n, x)));
      if (n.id && n.type === 'FunctionExpression') declIn(n, n.id.name);
      if (n.id && n.type === 'FunctionDeclaration') for (let i = anc.length - 2; i >= 0; i--){ if (isBlock(anc[i])){ declIn(anc[i], n.id.name); break; } }
    } else if (n.type === 'ClassDeclaration'){ for (let i = anc.length - 2; i >= 0; i--){ if (isBlock(anc[i])){ declIn(anc[i], n.id.name); break; } } }
    else if (n.type === 'CatchClause' && n.param) patNames(n.param).forEach(x => declIn(n, x));
  });
  const isLocal = (name, anc) => { for (let i = anc.length - 2; i >= 0; i--){ const a = anc[i]; if (a.type === 'Program') return false; const sc = scopes.get(a); if (sc && sc.has(name)) return true; } return false; };
  for (const sc of scopes.values()) sc.forEach(x => local.add(x));
  walk.ancestor(ast, {
    Identifier(n, st, anc){ if (!isLocal(n.name, anc)) refs.add(n.name); },
    AssignmentExpression(n, st, anc){ patNames(n.left).forEach(x => { if (!isLocal(x, anc.concat([n.left]))) assigned.add(x); }); },
    UpdateExpression(n, st, anc){ if (n.argument.type === 'Identifier' && !isLocal(n.argument.name, anc.concat([n.argument]))) assigned.add(n.argument.name); },
  });
  // identificadores en shorthand {a} ya los visita como Identifier (value)
  mods[f] = {code, ast, decl, refs, assigned, topStmts, local, sideFx};
}

const owner = new Map();
let bad = false;
for (const [f, m] of Object.entries(mods)) for (const name of m.decl.keys()){
  if (owner.has(name)){ console.error(`DUPLICADO: ${name} en ${path.relative(ROOT, owner.get(name))} y ${path.relative(ROOT, f)}`); bad = true; }
  else owner.set(name, f);
}

const usedElsewhere = new Set();
const plan = {};
for (const [f, m] of Object.entries(mods)){
  const imp = {};
  for (const name of new Set([...m.refs, ...m.assigned])){
    if (m.decl.has(name)) continue;
    const o = owner.get(name);
    if (!o){ if (!GLOBALS.has(name) && !m.local.has(name) && !/^(undefined|arguments)$/.test(name)) (m.unknown ||= new Set()).add(name); continue; }
    (imp[o] ||= []).push(name);
    usedElsewhere.add(o + '#' + name);
    if (m.assigned.has(name)){ console.error(`ASIGNA IMPORTADO: ${name} en ${path.relative(ROOT, f)} (declarado en ${path.relative(ROOT, o)})`); bad = true; }
  }
  plan[f] = imp;
}

for (const [f, m] of Object.entries(mods)){
  const s = new MagicString(m.code);
  const exported = new Set();
  for (const [name, node] of m.decl){
    if (usedElsewhere.has(f + '#' + name) && !exported.has(node)){ s.prependLeft(node.start, 'export '); exported.add(node); }
  }
  const lines = Object.keys(plan[f]).sort().map(o => {
    let rel = path.relative(path.dirname(f), o); if (!rel.startsWith('.')) rel = './' + rel;
    return `import { ${plan[f][o].sort().join(', ')} } from '${rel}';`;
  });
  const all = lines.concat(m.sideFx);
  const out = (all.length ? all.join('\n') + '\n\n' : '') + s.toString();
  fs.writeFileSync(f, out);
  if (m.unknown && m.unknown.size) console.error(`SIN DECLARAR en ${path.relative(ROOT, f)}: ${[...m.unknown].join(', ')}`);
}
// sentencias sueltas de nivel superior (se ejecutan al cargar el módulo)
if (process.argv.includes('--top')) for (const [f, m] of Object.entries(mods)) if (m.topStmts.length) console.log('TOP', path.relative(ROOT, f), m.topStmts.map(n => m.code.slice(n.start, n.start + 50).replace(/\n/g, ' ')).join(' | '));
if (bad) process.exitCode = 1;
console.log('ok', files.length, 'módulos');
