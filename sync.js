#!/usr/bin/env node
/**
 * Sync toon-blast-game → GitHub + Vercel
 * Run after any project change: node sync.js [commit message]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = __dirname;
const OWNER = process.env.GITHUB_OWNER || 'Futuret3chdev';
const REPO = process.env.GITHUB_REPO || 'toon-blast-game';
const MESSAGE = process.argv[2] || `Update ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

const SKIP = new Set(['.git', '.vercel', '.tools', 'node_modules', '.DS_Store']);
const SKIP_EXT = /\.(log)$/;

function getGhToken() {
  const ghPaths = [
    path.join(ROOT, '.tools/gh'),
    '/tmp/gh_2.63.2_macOS_amd64/bin/gh',
    'gh'
  ];
  for (const gh of ghPaths) {
    try {
      return execSync(`"${gh}" auth token`, { encoding: 'utf8' }).trim();
    } catch (_) {}
  }
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  throw new Error('GitHub not authenticated. Run: gh auth login');
}

function api(token, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'toon-blast-sync',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function walk(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(dir, entry.name), rel));
    else if (!SKIP_EXT.test(entry.name)) files.push(rel);
  }
  return files;
}

async function uploadFile(token, filePath) {
  const full = path.join(ROOT, filePath);
  const content = fs.readFileSync(full).toString('base64');
  const get = await api(token, 'GET', `/repos/${OWNER}/${REPO}/contents/${filePath}`);
  const sha = get.status === 200 ? get.data.sha : undefined;
  const put = await api(token, 'PUT', `/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    message: MESSAGE,
    content,
    ...(sha ? { sha } : {})
  });
  if (put.status !== 200 && put.status !== 201) {
    throw new Error(`Failed ${filePath}: ${put.status} ${JSON.stringify(put.data)}`);
  }
  return filePath;
}

async function syncGitHub(token) {
  const files = walk(ROOT);
  console.log(`\n📦 GitHub: uploading ${files.length} files to ${OWNER}/${REPO}...`);
  for (const f of files) {
    await uploadFile(token, f);
    process.stdout.write(`  ✓ ${f}\n`);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`✅ GitHub: https://github.com/${OWNER}/${REPO}`);
}

function syncVercel() {
  const nodeBin = process.env.NODE_BIN || '/tmp/node-v22.16.0-darwin-x64/bin';
  const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH || ''}` };
  console.log('\n🚀 Vercel: deploying to production...');
  try {
    execSync('npx vercel@latest --prod --yes', { cwd: ROOT, env, stdio: 'inherit' });
    console.log('✅ Vercel: https://toon-blast.vercel.app');
  } catch (e) {
    console.error('⚠️  Vercel deploy failed — GitHub push succeeded. Vercel may auto-deploy via Git integration.');
    process.exitCode = 1;
  }
}

(async () => {
  console.log(`🎮 Toon Blast Sync — "${MESSAGE}"`);
  const token = getGhToken();
  await syncGitHub(token);
  syncVercel();
})();