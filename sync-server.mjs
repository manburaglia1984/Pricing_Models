#!/usr/bin/env node
/**
 * Local sync server for the pricing model — the alternative to letting the browser
 * write the file itself, for browsers without the File System Access API and for
 * sharing one store between people on a machine or a LAN.
 *
 *   node sync-server.mjs                  serve this folder on http://127.0.0.1:8787
 *   node sync-server.mjs --port 9000      pick the port
 *   node sync-server.mjs --data ./mystore  pick the data folder
 *   node sync-server.mjs --host 0.0.0.0   let other machines on the LAN reach it
 *   node sync-server.mjs --backups ~/bk   put the timestamped copies elsewhere
 *   node sync-server.mjs --keep 0         no backups at all
 *
 * For several people on one store, run ONE of these and have everyone browse to it
 * (--host 0.0.0.0). Do not instead put data/ in a OneDrive- or SharePoint-synced folder
 * and run a server each: sync is last-writer-wins across machines and would hand you
 * conflict copies rather than a shared store. The revision check below makes that case
 * fail loudly rather than silently, but one server is the arrangement that works.
 *
 * Then open the address it prints. The page finds the API on its own and switches
 * from "this browser only" to reading and writing data/pricing-store.json.
 *
 * No dependencies — Node 18 or newer, nothing to install. Nothing is sent anywhere:
 * it binds to loopback unless you ask otherwise, and there is no auth, so --host
 * only belongs on a network you trust.
 *
 *   GET  /api/store   -> {api, rev, savedAt, file, store}
 *   GET  /api/rev     -> {api, rev}            what the pages poll to see each other's saves
 *   PUT  /api/store   <- {rev, force, store}   409 if rev is stale and force is not set
 *
 * `rev` is a hash of the file's contents, so a change made by anything at all — another
 * page, a sync client, an editor, a restore from backups — invalidates a save based on
 * an earlier read rather than being overwritten by it.
 */
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg('port', process.env.PORT || 8787));
const HOST = arg('host', '127.0.0.1');
const DATA = path.resolve(ROOT, arg('data', 'data'));
const STORE = path.join(DATA, 'pricing-store.json');
const BACKUPS = path.resolve(ROOT, arg('backups', path.join(DATA, 'backups')));
const KEEP = Number(arg('keep', 200));
// What the page shows as "Saved to …": the tidy relative path when the data folder sits
// inside this one, the full path when --data points somewhere else.
const REL = (() => { const r = path.relative(ROOT, STORE); return r.startsWith('..') ? STORE : r; })();
const MAX_BODY = 64 * 1024 * 1024;

const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.csv':'text/csv; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2'};

/* The revision is a hash of the file's own contents, not a counter this process keeps.
   That matters: a counter only sees writes that came through this server, so a file
   replaced underneath it — by OneDrive or SharePoint sync, by an editor, by a restore
   from data/backups — would keep the old counter and the next save would silently
   overwrite the incoming copy. Hashing the bytes on disk means any change by anything
   is a change of revision, so a save based on what a page last read is refused instead.
   The hash is cached against the file's mtime and size so polling costs a stat. */
let revCache = {key:'', rev:'empty'};
async function currentRev(){
  let st;
  try{ st = await fs.stat(STORE); }catch(e){ revCache = {key:'', rev:'empty'}; return 'empty'; }
  const key = st.mtimeMs + ':' + st.size;
  if(key === revCache.key) return revCache.rev;
  let rev = 'empty';
  try{ rev = createHash('sha256').update(await fs.readFile(STORE)).digest('hex').slice(0, 12); }
  catch(e){ return 'empty'; }
  revCache = {key, rev};
  return rev;
}

const json = (res, code, body) => {
  const text = JSON.stringify(body);
  res.writeHead(code, {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store', 'content-length':Buffer.byteLength(text)});
  res.end(text);
};

async function readStore(){
  try{
    const raw = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(raw);
    return {store:parsed, savedAt:parsed?.savedAt || null};
  }catch(e){
    if(e.code !== 'ENOENT') console.error('Could not read ' + STORE + ':', e.message);
    return {store:null, savedAt:null};
  }
}

/** Write via a temp file and rename, so a crash mid-write cannot truncate the store. */
async function writeStore(store){
  const text = JSON.stringify(store, null, 2);
  const tmp = STORE + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, STORE);
  if(KEEP > 0){
    await fs.mkdir(BACKUPS, {recursive:true});
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await fs.writeFile(path.join(BACKUPS, 'pricing-store-' + stamp + '.json'), text, 'utf8');
    await prune();
  }
  return text.length;
}

async function prune(){
  try{
    const files = (await fs.readdir(BACKUPS)).filter(f => /^pricing-store-.*\.json$/.test(f)).sort();
    for(const f of files.slice(0, Math.max(0, files.length - KEEP)))
      await fs.unlink(path.join(BACKUPS, f)).catch(() => {});
  }catch(e){ /* a missing backup folder is not worth failing a save over */ }
}

function body(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if(size > MAX_BODY){ reject(new Error('Body larger than ' + (MAX_BODY >> 20) + 'MB')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname){
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  // Never serve outside the folder this script sits in, whatever the path claims.
  if(file !== ROOT && !file.startsWith(ROOT + path.sep)) return json(res, 403, {error:'Forbidden'});
  let stat;
  try{ stat = await fs.stat(file); }catch(e){ return json(res, 404, {error:'Not found: ' + rel}); }
  if(stat.isDirectory()) return serveStatic(req, res, pathname.replace(/\/*$/, '/') + 'index.html');
  res.writeHead(200, {'content-type':TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length':stat.size, 'cache-control':'no-store'});
  if(req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const {pathname} = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try{
    if(pathname === '/api/store'){
      if(req.method === 'GET' || req.method === 'HEAD'){
        const {store, savedAt} = await readStore();
        return json(res, 200, {api:'cantu-pricing-store', rev:await currentRev(), savedAt, file:REL, store});
      }
      if(req.method === 'PUT' || req.method === 'POST'){
        let msg;
        try{ msg = JSON.parse(await body(req)); }
        catch(e){ return json(res, 400, {error:'Body is not valid JSON: ' + e.message}); }
        const {store} = msg || {};
        if(!store || !Array.isArray(store.deals) || !Array.isArray(store.trades))
          return json(res, 400, {error:'Expected {store:{deals:[],trades:[]}}'});
        const was = await currentRev();
        if(!msg.force && String(msg.rev) !== was)
          return json(res, 409, {error:'Stale revision', rev:was, yours:String(msg.rev ?? '')});
        const bytes = await writeStore(store);
        const now = await currentRev();
        console.log(new Date().toISOString(), 'saved', was + ' -> ' + now,
          store.deals.length + ' deal(s)', store.trades.length + ' trade(s)', bytes + ' bytes',
          'by ' + (store.lastActor || 'unknown'));
        return json(res, 200, {api:'cantu-pricing-store', rev:now, savedAt:store.savedAt || null, file:REL});
      }
      res.writeHead(405, {allow:'GET, HEAD, PUT'});
      return res.end();
    }
    if(pathname === '/api/rev'){
      // What the pages poll so each one notices the others' saves. Deliberately tiny:
      // a stat and a cached hash, no store serialisation.
      if(req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405, {allow:'GET, HEAD'}); return res.end(); }
      return json(res, 200, {api:'cantu-pricing-store', rev:await currentRev()});
    }
    if(req.method !== 'GET' && req.method !== 'HEAD'){
      res.writeHead(405, {allow:'GET, HEAD'});
      return res.end();
    }
    await serveStatic(req, res, pathname);
  }catch(e){
    console.error('Request failed:', e);
    if(!res.headersSent) json(res, 500, {error:e.message});
    else res.end();
  }
});

await fs.mkdir(DATA, {recursive:true});
// Seed `rev` past nothing in particular, but do report whether a store is already there.
const existing = await readStore();
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  console.log('Pricing model  http://' + shown + ':' + PORT + '/');
  console.log('Store          ' + STORE + (existing.store
    ? '  (' + existing.store.deals.length + ' deal(s), ' + existing.store.trades.length +
      ' trade(s), saved ' + (existing.savedAt || 'unknown') + ')'
    : '  (empty — the first save from the page creates it)'));
  console.log('Backups        ' + (KEEP > 0 ? BACKUPS + '  (last ' + KEEP + ' kept)' : 'off (--keep 0)'));
  console.log('Stop with Ctrl-C. Nothing leaves this machine' + (HOST === '127.0.0.1' ? '.' : ' beyond ' + HOST + '.'));
});
server.on('error', e => {
  if(e.code === 'EADDRINUSE') console.error('Port ' + PORT + ' is already in use — try: node sync-server.mjs --port ' + (PORT + 1));
  else console.error(e.message);
  process.exit(1);
});
