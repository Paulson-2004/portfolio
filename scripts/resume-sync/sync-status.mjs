#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITATIVE_RESUME_ID,
  DEFAULT_API_BASE_URL,
  fetchAuthoritativeResumeMeta,
  sanitizeText,
  verifyPortfolioAssetConsistency,
} from './lib/sync-core.mjs';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(THIS_DIR, '..', '..');

function parseArgs(argv) {
  const args = {
    repoRoot: DEFAULT_REPO_ROOT,
    checkLive: Boolean(process.env.REACTIVE_RESUME_API_KEY),
    checkGithub: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--repo-root') args.repoRoot = path.resolve(argv[++i] || '');
    else if (flag === '--live') args.checkLive = true;
    else if (flag === '--no-live') args.checkLive = false;
    else if (flag === '--github') args.checkGithub = true;
    else if (flag === '--json') args.json = true;
  }
  return args;
}

function queryGithubStatus(repoRoot) {
  try {
    const rawRuns = execFileSync(
      'gh',
      [
        'run',
        'list',
        '--workflow',
        'sync-resume.yml',
        '--limit',
        '5',
        '--json',
        'databaseId,status,conclusion,createdAt,event,url',
      ],
      { cwd: repoRoot, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const runs = JSON.parse(rawRuns);

    const rawIssues = execFileSync(
      'gh',
      [
        'issue',
        'list',
        '--label',
        'resume-sync-alert',
        '--state',
        'open',
        '--json',
        'number,title,updatedAt,url',
      ],
      { cwd: repoRoot, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const openAlerts = JSON.parse(rawIssues);

    const latestRun = runs[0] || null;
    const latestSuccess = runs.find((run) => run.conclusion === 'success') || null;
    return {
      available: true,
      latestRun,
      latestRunFailed: latestRun ? latestRun.conclusion === 'failure' || latestRun.conclusion === 'cancelled' : null,
      lastSuccessfulWorkflowRun: latestSuccess,
      openAlertIssues: openAlerts,
    };
  } catch (err) {
    return {
      available: false,
      error: err?.message || 'Unable to query GitHub CLI.',
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.REACTIVE_RESUME_API_KEY || '';
  const secrets = [apiKey];

  const local = verifyPortfolioAssetConsistency(args.repoRoot);
  const manifest = local.manifest;

  let live = { checked: false, reason: 'REACTIVE_RESUME_API_KEY not set in environment.' };
  if (args.checkLive && apiKey) {
    try {
      const meta = await fetchAuthoritativeResumeMeta({
        baseUrl: process.env.REACTIVE_RESUME_API_BASE || DEFAULT_API_BASE_URL,
        resumeId: AUTHORITATIVE_RESUME_ID,
        apiKey,
      });
      const upToDate =
        local.valid &&
        manifest?.source?.updatedAt === meta.updatedAt &&
        manifest?.source?.contentHash === meta.contentHash;
      live = {
        checked: true,
        resumeId: meta.resumeId,
        lastDetectedSourceUpdate: meta.updatedAt,
        upToDate,
      };
    } catch (err) {
      live = {
        checked: true,
        error: sanitizeText(err?.message || String(err), secrets),
        upToDate: null,
      };
    }
  }

  const github = args.checkGithub ? queryGithubStatus(args.repoRoot) : { checked: false };

  const statusSummary = {
    authoritativeResumeId: AUTHORITATIVE_RESUME_ID,
    lastSuccessfulSync: manifest?.sync?.lastSuccessfulSyncAt || null,
    lastDetectedSourceUpdate: live.lastDetectedSourceUpdate || manifest?.source?.updatedAt || null,
    currentlySynchronizedRevision: manifest?.sync?.revision || null,
    shortVersion: manifest?.sync?.shortVersion || null,
    localArtifactsValid: local.valid,
    localIntegrityMessage: local.reason,
    upToDate: live.checked ? live.upToDate : null,
    latestWorkflowFailed: github.available ? github.latestRunFailed : null,
    failureReason: live.error || (github.openAlertIssues?.[0]?.title ?? null),
    liveCheck: live,
    githubWorkflows: github,
  };

  if (args.json) {
    console.log(JSON.stringify(statusSummary, null, 2));
  } else {
    console.log('=== Portfolio Reactive Resume Sync Status ===');
    console.log(`Target Resume ID:               ${statusSummary.authoritativeResumeId}`);
    console.log(`Last Successful Sync:           ${statusSummary.lastSuccessfulSync || 'never'}`);
    console.log(`Last Detected Source Update:    ${statusSummary.lastDetectedSourceUpdate || 'unknown'}`);
    console.log(`Current Synchronized Revision:  ${statusSummary.currentlySynchronizedRevision || 'none'}`);
    console.log(`Local Artifacts Consistent:     ${statusSummary.localArtifactsValid} (${statusSummary.localIntegrityMessage})`);
    console.log(`Portfolio Up To Date (Live):    ${statusSummary.upToDate === null ? 'not checked (no API key in env)' : statusSummary.upToDate}`);
    if (args.checkGithub) {
      console.log(`Latest Workflow Failed:         ${statusSummary.latestWorkflowFailed}`);
      if (github.latestRun) {
        console.log(`Latest Workflow Run:            ${github.latestRun.conclusion || github.latestRun.status} (${github.latestRun.url})`);
      }
      if (github.openAlertIssues?.length) {
        console.log(`Open Sync Alert Issue:          #${github.openAlertIssues[0].number} - ${github.openAlertIssues[0].title}`);
      }
    }
    if (statusSummary.failureReason) {
      console.log(`Failure Reason:                 ${statusSummary.failureReason}`);
    }
  }
}

await main();
