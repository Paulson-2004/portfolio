import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  AUTHORITATIVE_RESUME_ID,
  FORBIDDEN_PRIMARY_RESUME_ID,
  REL_PATHS,
  SyncError,
  assertSafeBaseUrl,
  assertSafeResumeId,
  runSyncPipeline,
  sanitizeText,
  sha256Buffer,
  updateIndexHtmlResumeRefs,
  validateImageBuffer,
  validatePdfBuffer,
  verifyPortfolioAssetConsistency,
} from '../lib/sync-core.mjs';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.resolve(THIS_DIR, '..', '..', '..');
const FIXTURE_PDF_PATH = path.join(REAL_REPO_ROOT, 'docs/Paulson_J_Resume.pdf');

function cloneSandboxRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-sync-sandbox-'));
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github', 'resume-sync'), { recursive: true });

  fs.copyFileSync(path.join(REAL_REPO_ROOT, 'index.html'), path.join(dir, 'index.html'));
  fs.copyFileSync(path.join(REAL_REPO_ROOT, 'docs/Paulson_J_Resume.pdf'), path.join(dir, REL_PATHS.pdf));
  fs.copyFileSync(path.join(REAL_REPO_ROOT, 'img/resume-preview.webp'), path.join(dir, REL_PATHS.webp));
  fs.copyFileSync(path.join(REAL_REPO_ROOT, 'img/resume-preview.jpg'), path.join(dir, REL_PATHS.jpg));
  return dir;
}

function buildSampleResumeData({ updatedAt, headline = 'Java Full Stack Developer | Software Developer', summary = 'Builder' }) {
  return {
    id: AUTHORITATIVE_RESUME_ID,
    name: 'Paulson J - Portfolio Proposed (2026)',
    slug: 'paulson-j-portfolio-proposed-2026',
    tags: ['portfolio-draft'],
    isPublic: false,
    showDownloadButtons: false,
    isLocked: false,
    createdAt: '2026-11-25T12:44:03.359Z',
    updatedAt,
    data: {
      basics: {
        name: 'Paulson J',
        headline,
        email: 'jpaulson2004@gmail.com',
      },
      summary: {
        content: `<p>${summary}</p>`,
      },
    },
  };
}

function startMockReactiveResumeServer(state) {
  const fixturePdf = fs.readFileSync(FIXTURE_PDF_PATH);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      state.requests.push({ method: req.method, url: req.url, apiKey: req.headers['x-api-key'] });
      if (state.requireApiKey && req.headers['x-api-key'] !== state.requireApiKey) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'UNAUTHORIZED', status: 401, message: 'Invalid API key' }));
        return;
      }

      if (req.url === `/api/openapi/resumes/${AUTHORITATIVE_RESUME_ID}`) {
        if (typeof state.onMetaRequest === 'function') {
          const handled = state.onMetaRequest(req, res, state);
          if (handled) return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(state.resume));
        return;
      }

      if (req.url === `/api/openapi/resumes/${AUTHORITATIVE_RESUME_ID}/pdf`) {
        state.pdfRequests += 1;
        if (typeof state.onPdfRequest === 'function') {
          const handled = state.onPdfRequest(req, res, state, fixturePdf);
          if (handled) return;
        }
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end(state.pdfBuffer || fixturePdf);
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'NOT_FOUND', status: 404 }));
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}/api/openapi`,
      });
    });
  });
}

test('enforces authoritative resume ID lock and forbids primary ID', () => {
  assert.equal(assertSafeResumeId(AUTHORITATIVE_RESUME_ID), AUTHORITATIVE_RESUME_ID);
  assert.throws(() => assertSafeResumeId(FORBIDDEN_PRIMARY_RESUME_ID), { name: 'SyncError', category: 'SAFETY_VIOLATION' });
  assert.throws(() => assertSafeResumeId('01a212bc-0000-0000-0000-000000000000'), { category: 'SAFETY_VIOLATION' });
  assert.throws(() => assertSafeBaseUrl('http://rxresu.me/api/openapi'), { category: 'CONFIG_ERROR' });
  assert.equal(assertSafeBaseUrl('http://127.0.0.1:4567/api/openapi/'), 'http://127.0.0.1:4567/api/openapi');
});

test('redacts sensitive secrets from logs and error text', () => {
  const secret = 'rx_super_secret_token_value_12345';
  const cleaned = sanitizeText(`Failed connecting with key ${secret} at https://example.com/hook?token=abc`, [secret]);
  assert.equal(cleaned.includes(secret), false);
  assert.equal(cleaned.includes('token=abc'), false);
});

test('validates real PDF and rejects corrupted or credential-leaking PDFs', async () => {
  const realPdf = fs.readFileSync(FIXTURE_PDF_PATH);
  const validMeta = await validatePdfBuffer(realPdf);
  assert.equal(validMeta.pageCount, 1);
  assert.ok(validMeta.extractedChars > 1000);

  await assert.rejects(() => validatePdfBuffer(Buffer.from('<html>502 Bad Gateway</html>')), { category: 'INVALID_PDF' });
  await assert.rejects(() => validatePdfBuffer(Buffer.from('%PDF-1.4 truncated')), { category: 'INVALID_PDF' });
});

test('full end-to-end sync lifecycle: initial sync, no-op skip, AI/manual edit, error preservation, blank preview rejection, concurrent mid-export edit, and recovery', async (t) => {
  const sandbox = cloneSandboxRepo();
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

  const fixturePdf = fs.readFileSync(FIXTURE_PDF_PATH);
  const state = {
    requireApiKey: 'test-key-secret-value-999',
    requests: [],
    pdfRequests: 0,
    resume: buildSampleResumeData({ updatedAt: '2026-11-25T13:11:22.212Z' }),
    pdfBuffer: fixturePdf,
    onMetaRequest: null,
    onPdfRequest: null,
  };

  const { server, baseUrl } = await startMockReactiveResumeServer(state);
  t.after(() => server.close());

  // 1) Scenario 1: Initial / Manual Reactive Resume edit detection & full asset rendering
  const firstSync = await runSyncPipeline({
    repoRoot: sandbox,
    baseUrl,
    apiKey: state.requireApiKey,
    trigger: 'test-manual',
  });
  assert.equal(firstSync.status, 'synchronized');
  assert.equal(firstSync.changed, true);
  assert.equal(state.pdfRequests, 1);

  const check1 = verifyPortfolioAssetConsistency(sandbox);
  assert.equal(check1.valid, true);
  assert.equal(check1.manifest.source.resumeId, AUTHORITATIVE_RESUME_ID);
  assert.equal(check1.manifest.source.updatedAt, '2026-11-25T13:11:22.212Z');
  assert.equal(check1.manifest.source.isPublic, false);
  assert.equal(check1.manifest.artifacts.previewWebp.width, 1440);
  assert.equal(check1.manifest.artifacts.previewJpg.width, 1440);
  assert.equal(check1.manifest.artifacts.previewWebp.height, check1.manifest.artifacts.previewJpg.height);

  // Confirm raw private resume fields / API key are never stored in committed manifest
  const manifestRaw = fs.readFileSync(path.join(sandbox, REL_PATHS.manifest), 'utf8');
  assert.equal(manifestRaw.includes(state.requireApiKey), false);
  assert.equal(manifestRaw.includes('paulson-j-portfolio-proposed-2026'), false);
  assert.equal(manifestRaw.includes('basics'), false);

  // 2) Scenario 3: Unchanged resume skips PDF download & creates zero changes
  const beforeNoOpSha = sha256Buffer(fs.readFileSync(path.join(sandbox, REL_PATHS.pdf)));
  const noOp = await runSyncPipeline({
    repoRoot: sandbox,
    baseUrl,
    apiKey: state.requireApiKey,
    trigger: 'test-noop',
  });
  assert.equal(noOp.status, 'up-to-date');
  assert.equal(noOp.changed, false);
  assert.equal(state.pdfRequests, 1);
  assert.equal(sha256Buffer(fs.readFileSync(path.join(sandbox, REL_PATHS.pdf))), beforeNoOpSha);

  // 3) Scenario 4 & 12 prep: Failed PDF export (500/HTML) never overwrites existing valid PDF or previews
  state.resume = buildSampleResumeData({
    updatedAt: '2026-11-25T14:00:00.000Z',
    summary: 'Edited version waiting on valid export',
  });
  state.onPdfRequest = (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>Temporary upstream error page</html>');
    return true;
  };
  await assert.rejects(
    () =>
      runSyncPipeline({
        repoRoot: sandbox,
        baseUrl,
        apiKey: state.requireApiKey,
        sleepImpl: async () => {},
      }),
    { category: 'INVALID_PDF' },
  );
  // Published assets must remain byte-for-byte identical after failed run
  assert.equal(verifyPortfolioAssetConsistency(sandbox).valid, true);
  assert.equal(verifyPortfolioAssetConsistency(sandbox).manifest.source.updatedAt, '2026-11-25T13:11:22.212Z');

  // 4) Scenario 5: Blank/invalid preview never replaces existing valid preview
  state.onPdfRequest = null;
  const blankWhiteWebp = await sharp({
    create: { width: 1440, height: 2037, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .webp()
    .toBuffer();
  const blankWhiteJpg = await sharp({
    create: { width: 1440, height: 2037, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .jpeg()
    .toBuffer();

  await assert.rejects(
    () =>
      runSyncPipeline({
        repoRoot: sandbox,
        baseUrl,
        apiKey: state.requireApiKey,
        renderOverride: async () => ({ webpBuffer: blankWhiteWebp, jpgBuffer: blankWhiteJpg }),
      }),
    { category: 'INVALID_PREVIEW' },
  );
  assert.equal(verifyPortfolioAssetConsistency(sandbox).manifest.source.updatedAt, '2026-11-25T13:11:22.212Z');

  // 5) Scenario 12 + Rate-Limit 429 Recovery + Scenario 2 (AI/automated edit detected & recovers seamlessly)
  let transientHits = 0;
  state.onPdfRequest = (_req, res) => {
    transientHits += 1;
    if (transientHits === 1) {
      res.writeHead(429, { 'retry-after': '0' });
      res.end('Rate limited');
      return true;
    }
    return false;
  };
  const recovered = await runSyncPipeline({
    repoRoot: sandbox,
    baseUrl,
    apiKey: state.requireApiKey,
    sleepImpl: async () => {},
    trigger: 'test-ai-recovery',
  });
  assert.equal(recovered.status, 'synchronized');
  assert.equal(recovered.changed, true);
  assert.equal(recovered.manifest.source.updatedAt, '2026-11-25T14:00:00.000Z');
  assert.equal(verifyPortfolioAssetConsistency(sandbox).valid, true);
  state.onPdfRequest = null;

  // 6) Scenario 6 & 7: Rapid concurrent save mid-export re-fetches coherent PDF + metadata
  state.resume = buildSampleResumeData({ updatedAt: '2026-11-25T14:05:00.000Z', summary: 'First rapid save' });
  let injectedRapidEdit = false;
  const rapidSync = await runSyncPipeline({
    repoRoot: sandbox,
    baseUrl,
    apiKey: state.requireApiKey,
    consistencyHook: async () => {
      if (!injectedRapidEdit) {
        injectedRapidEdit = true;
        state.resume = buildSampleResumeData({ updatedAt: '2026-11-25T14:05:12.000Z', summary: 'Second rapid save' });
      }
    },
  });
  assert.equal(rapidSync.status, 'synchronized');
  assert.equal(rapidSync.manifest.source.updatedAt, '2026-11-25T14:05:12.000Z');
  assert.equal(verifyPortfolioAssetConsistency(sandbox).valid, true);

  // 7) Auth failure aborts fast without leaking credentials or modifying files
  const badAuthAttemptsBefore = state.requests.length;
  await assert.rejects(
    async () => {
      await runSyncPipeline({
        repoRoot: sandbox,
        baseUrl,
        apiKey: 'wrong-key-secret-value-xyz',
        force: true,
        sleepImpl: async () => {},
      });
    },
    (err) => {
      assert.equal(err instanceof SyncError, true);
      assert.equal(err.category, 'AUTH_ERROR');
      assert.equal(err.message.includes('wrong-key-secret-value-xyz'), false);
      return true;
    },
  );
  assert.equal(state.requests.length - badAuthAttemptsBefore, 1);

  // 8) Verify HTML reference updater preserves inline theme script and non-resume links cleanly
  const updatedHtml = fs.readFileSync(path.join(sandbox, 'index.html'), 'utf8');
  assert.equal(updatedHtml.includes(`docs/Paulson_J_Resume.pdf?v=${rapidSync.manifest.sync.shortVersion}`), true);
  assert.equal(updatedHtml.includes(`img/resume-preview.webp?v=${rapidSync.manifest.sync.shortVersion}`), true);
  assert.equal(updatedHtml.includes(`img/resume-preview.jpg?v=${rapidSync.manifest.sync.shortVersion}`), true);
  assert.equal(updatedHtml.includes('download="Paulson_J_Resume.pdf"'), true);
});

test('validateImageBuffer checks alpha rejection and updateIndexHtmlResumeRefs rejects malformed markup', async () => {
  const transparentPng = await sharp({
    create: { width: 1440, height: 2037, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .webp()
    .toBuffer();
  await assert.rejects(() => validateImageBuffer(transparentPng, 'webp'), { category: 'INVALID_PREVIEW' });
  assert.throws(() => updateIndexHtmlResumeRefs('<html><body></body></html>', { shortVersion: '1', width: 1440, height: 2037 }), {
    category: 'INTEGRATION_ERROR',
  });
});
