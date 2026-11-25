#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITATIVE_RESUME_ID,
  DEFAULT_API_BASE_URL,
  SyncError,
  runSyncPipeline,
  sanitizeText,
} from './lib/sync-core.mjs';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(THIS_DIR, '..', '..');

function parseArgs(argv) {
  const args = {
    repoRoot: DEFAULT_REPO_ROOT,
    resumeId: process.env.REACTIVE_RESUME_ID || AUTHORITATIVE_RESUME_ID,
    baseUrl: process.env.REACTIVE_RESUME_API_BASE || DEFAULT_API_BASE_URL,
    force: false,
    dryRun: false,
    verifyOnly: false,
    trigger: process.env.SYNC_TRIGGER || 'cli',
    fromMeta: null,
    fromPdf: null,
    updatedAt: null,
    resumeName: null,
    statusOut: process.env.SYNC_STATUS_PATH || null,
    pdftoppmBin: process.env.PDFTOPPM_BIN || 'pdftoppm',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--force') args.force = true;
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--verify-only') args.verifyOnly = true;
    else if (flag === '--repo-root') args.repoRoot = path.resolve(argv[++i] || '');
    else if (flag === '--resume-id') args.resumeId = argv[++i] || '';
    else if (flag === '--api-base') args.baseUrl = argv[++i] || '';
    else if (flag === '--trigger') args.trigger = argv[++i] || 'cli';
    else if (flag === '--from-meta') args.fromMeta = path.resolve(argv[++i] || '');
    else if (flag === '--from-pdf') args.fromPdf = path.resolve(argv[++i] || '');
    else if (flag === '--updated-at') args.updatedAt = argv[++i] || '';
    else if (flag === '--resume-name') args.resumeName = argv[++i] || '';
    else if (flag === '--status-out') args.statusOut = path.resolve(argv[++i] || '');
    else if (flag === '--pdftoppm-bin') args.pdftoppmBin = argv[++i] || 'pdftoppm';
    else throw new SyncError('CONFIG_ERROR', `Unknown CLI argument: ${flag}`);
  }
  return args;
}

function writeGithubOutput(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(outputs).map(([key, val]) => `${key}=${String(val ?? '').replace(/[\r\n]+/g, ' ')}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function appendStepSummary(report) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const m = report.manifest;
  const rows = [
    '### Reactive Resume Synchronization Report',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| **Status** | \`${report.status}\` |`,
    `| **Changed** | \`${Boolean(report.changed)}\` |`,
    `| **Target Resume ID** | \`${report.resumeId}\` |`,
    `| **Trigger** | \`${report.trigger}\` |`,
    `| **Source Updated At** | \`${report.sourceUpdatedAt || m?.source?.updatedAt || 'unknown'}\` |`,
    `| **Last Successful Sync** | \`${m?.sync?.lastSuccessfulSyncAt || 'n/a'}\` |`,
    `| **Synchronized Revision** | \`${m?.sync?.revision || 'n/a'}\` |`,
    `| **Timestamp (UTC)** | \`${report.checkedAt}\` |`,
  ];
  if (report.failureReason) {
    rows.push(`| **Failure Category** | \`${report.failureCategory || 'ERROR'}\` |`);
    rows.push(`| **Failure Reason** | ${report.failureReason} |`);
  }
  rows.push('');
  fs.appendFileSync(summaryPath, `${rows.join('\n')}\n`, 'utf8');
}

async function main() {
  const apiKey = process.env.REACTIVE_RESUME_API_KEY || '';
  const deployHook = process.env.CLOUDFLARE_DEPLOY_HOOK_URL || '';
  const pushToken = process.env.PORTFOLIO_PUSH_TOKEN || '';
  const secrets = [apiKey, deployHook, pushToken];

  let args;
  let report;
  try {
    args = parseArgs(process.argv.slice(2));
    const fromFiles = args.fromMeta || args.fromPdf
      ? {
          metaPath: args.fromMeta,
          pdfPath: args.fromPdf,
          updatedAt: args.updatedAt,
          resumeName: args.resumeName,
        }
      : null;

    if (fromFiles && (!fromFiles.metaPath || !fromFiles.pdfPath)) {
      throw new SyncError('CONFIG_ERROR', 'Both --from-meta and --from-pdf are required together.');
    }

    const result = await runSyncPipeline({
      repoRoot: args.repoRoot,
      resumeId: args.resumeId,
      baseUrl: args.baseUrl,
      apiKey,
      force: args.force || process.env.SYNC_FORCE === 'true',
      dryRun: args.dryRun || process.env.SYNC_DRY_RUN === 'true',
      verifyOnly: args.verifyOnly,
      trigger: args.trigger,
      fromFiles,
      pdftoppmBin: args.pdftoppmBin,
    });

    report = {
      ok: true,
      checkedAt: new Date().toISOString(),
      status: result.status,
      changed: Boolean(result.changed),
      trigger: args.trigger,
      resumeId: args.resumeId,
      sourceUpdatedAt: result.sourceMeta?.updatedAt || result.manifest?.source?.updatedAt || null,
      manifest: result.manifest || null,
    };

    if (args.statusOut) {
      fs.mkdirSync(path.dirname(args.statusOut), { recursive: true });
      fs.writeFileSync(args.statusOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    writeGithubOutput({
      ok: 'true',
      status: report.status,
      changed: String(report.changed),
      revision: report.manifest?.sync?.revision || '',
      short_version: report.manifest?.sync?.shortVersion || '',
      source_updated_at: report.sourceUpdatedAt || '',
      failure_category: '',
      failure_reason: '',
    });
    appendStepSummary(report);
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    const category = err instanceof SyncError ? err.category : 'UNEXPECTED_ERROR';
    const cleanReason = sanitizeText(err?.message || String(err), secrets);
    const failedReport = {
      ok: false,
      checkedAt: new Date().toISOString(),
      status: 'failed',
      changed: false,
      trigger: args?.trigger || process.env.SYNC_TRIGGER || 'cli',
      resumeId: args?.resumeId || AUTHORITATIVE_RESUME_ID,
      failureCategory: category,
      failureReason: cleanReason,
      manifest: null,
    };

    if (args?.statusOut) {
      try {
        fs.mkdirSync(path.dirname(args.statusOut), { recursive: true });
        fs.writeFileSync(args.statusOut, `${JSON.stringify(failedReport, null, 2)}\n`, 'utf8');
      } catch {
        // Ignore report write failures when exiting on primary error.
      }
    }

    writeGithubOutput({
      ok: 'false',
      status: 'failed',
      changed: 'false',
      revision: '',
      short_version: '',
      source_updated_at: '',
      failure_category: category,
      failure_reason: cleanReason,
    });
    appendStepSummary(failedReport);
    console.error(JSON.stringify(failedReport, null, 2));
    process.exitCode = 1;
  }
}

await main();
