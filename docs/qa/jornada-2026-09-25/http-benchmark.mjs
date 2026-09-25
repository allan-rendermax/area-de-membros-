import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import { createServerClient } from '@supabase/ssr';

const label = process.argv[2] || 'baseline';
const target = resolve(process.argv[3] || '.superpowers/qa-baseline');
const port = Number(process.argv[4] || 3340);
const historyDelay = Number(process.argv[5] || 0);
const fixture = process.env.QA_BENCH_PROVIDER || 'http://127.0.0.1:3344';
const warmOnly = process.argv.includes('--warm-only');
const root = process.cwd();
writeFileSync(resolve('.superpowers/qa-local-only.mjs'), `const original = globalThis.fetch; globalThis.fetch = (input, init) => { const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('QA outbound fetch blocked'); return original(input, init); };`);
const output = resolve('.superpowers', `qa-${label}-${historyDelay}.json`);
const pause = ms => new Promise(r => setTimeout(r, ms));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const env = {
  ...process.env, SUPABASE_URL: fixture, SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
  SUPABASE_SECRET_KEY: 'fixture-service-key', APP_URL: `http://127.0.0.1:${port}`,
  ADMIN_EMAILS: 'admin@example.test', DEFAULT_STORE_SLUG: 'arquitetura',
  LOGIN_GUARD_SECRET: 'fixture-only-hmac-secret-32-chars-minimum', PAYT_INTEGRATION_KEY: 'fixture-payt',
  RESEND_API_KEY: 're_fixture', EMAIL_FROM: 'fixture@example.test', TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '',
  NODE_OPTIONS: `--import=${pathToFileURL(resolve('.superpowers/qa-local-only.mjs')).href}`,
};
async function control(path, data) {
  return (await fetch(fixture + path, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(data) })).json();
}
async function cookie(email) {
  const session = await control('/__qa/session', { email });
  const jar = new Map();
  const supabase = createServerClient(fixture, 'fixture-publishable-key', { cookies: { getAll: () => [...jar].map(([name,value])=>({name,value})), setAll: rows => rows.forEach(({name,value})=>jar.set(name,value)) } });
  const { error } = await supabase.auth.setSession(session);
  if (error) throw error;
  return [...jar].map(([name,value])=>`${name}=${value}`).join('; ');
}
let child;
const log = createWriteStream(resolve('.superpowers', `qa-${label}-server.log`), { flags: 'a' });
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
  child = null;
}
async function start() {
  await stop();
  child = spawn(process.execPath, [resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)], { cwd: target, env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(()=>reject(new Error('Next start timeout')), 30000);
    child.stdout.on('data', data => { if (data.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Next exited ${code}`)); });
  });
}
async function measured(path, sessionCookie) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}${path}`, { headers: { Cookie: sessionCookie }, agent: false }, res => {
      const ttfb = performance.now() - started;
      let bytes = 0, html = '';
      res.on('data', chunk => { bytes += chunk.length; html += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode, ttfbMs: ttfb, totalMs: performance.now()-started, bytes, location: res.headers.location ?? null, hasPlayer: html.includes('youtube-nocookie.com/embed/'), errorPage: html.includes('Internal Server Error') }));
    });
    req.once('error',reject); req.end();
  });
}
const rows = [];
await control('/__qa/latency', { ms: 25 });
await control('/__qa/history', { delayMs: historyDelay, fail: false });
try {
  for (const profile of ['basic','complete']) {
    const sessionCookie = await cookie(profile === 'basic' ? 'aluno@example.test' : 'completo@example.test');
    const scenarios = {
      product: '/arquitetura/produto/atlas-qa',
      video: `/arquitetura/item/${id(profile==='basic'?38:33)}`,
      public: `/arquitetura/item/${id(profile==='basic'?30:35)}/abrir`,
      private: `/arquitetura/item/${id(profile==='basic'?37:36)}/abrir`,
    };
    for (const [scenario,path] of Object.entries(scenarios)) {
      if (warmOnly) {
        if (scenario === 'product') continue;
        await start(); await measured(path, sessionCookie); await pause(historyDelay+120);
      }
      for (const temperature of (warmOnly ? ['warm'] : ['process-cold','warm'])) {
        for (let sample=1; sample<=5; sample++) {
          if (temperature==='process-cold') await start();
          await control('/__qa/metrics', {});
          const result = await measured(path, sessionCookie);
          await pause(historyDelay+120);
          const metrics = await (await fetch(fixture+'/__qa/metrics')).json();
          const expected = ['public','private'].includes(scenario) ? 307 : 200;
          if (result.status !== expected || result.errorPage || (scenario==='video' && !result.hasPlayer)) throw new Error(`Bad response ${profile} ${scenario}: ${JSON.stringify(result)}`);
          rows.push({ label, profile, scenario, temperature, sample, historyDelay, ...result, requests: metrics.requests });
          writeFileSync(output, JSON.stringify({ fixtureLatencyMs:25, rows },null,2));
        }
      }
      console.log(`${label}: ${profile} ${scenario}, ${warmOnly ? '5 warm' : '5 cold + 5 warm'} collected`);
    }
  }
} finally { await stop(); log.end(); }
console.log(`Saved ${rows.length} measurements to ${output}`);
