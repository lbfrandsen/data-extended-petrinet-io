const GITHUB_API_BASE = 'https://api.github.com';
import { createSign } from 'node:crypto';

function createJsonResponse(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (!origin) {
    return '*';
  }

  if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
    return origin;
  }

  return 'null';
}

function sanitizeIssueText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function base64UrlEncode(input) {
  const base64 = btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizePem(privateKeyPem) {
  let normalizedPem = String(privateKeyPem || '').trim();

  if (
    (normalizedPem.startsWith('"') && normalizedPem.endsWith('"'))
    || (normalizedPem.startsWith("'") && normalizedPem.endsWith("'"))
  ) {
    normalizedPem = normalizedPem.slice(1, -1);
  }

  return normalizedPem
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
}

async function createGitHubAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 30,
    exp: now + (9 * 60),
    iss: appId
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const normalizedPem = normalizePem(privateKeyPem);

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signatureBase64 = signer.sign(normalizedPem, 'base64');
  const encodedSignature = signatureBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${signingInput}.${encodedSignature}`;
}

async function getInstallationAccessToken(env) {
  const appId = String(env.GITHUB_APP_ID || '').trim();
  const installationId = String(env.GITHUB_APP_INSTALLATION_ID || '').trim();
  const privateKey = String(env.GITHUB_APP_PRIVATE_KEY || '').trim();

  if (!appId || !installationId || !privateKey) {
    return { ok: false, error: 'GitHub App credentials are missing' };
  }

  let jwt;
  try {
    jwt = await createGitHubAppJwt(appId, privateKey);
  } catch (_error) {
    return {
      ok: false,
      error: 'Failed to parse GitHub App private key. Ensure full PEM content is set in GITHUB_APP_PRIVATE_KEY.'
    };
  }

  const tokenResponse = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'petrinet-io-issue-reporter'
    }
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    return {
      ok: false,
      error: 'Failed to get installation token',
      status: tokenResponse.status,
      details: details.slice(0, 600)
    };
  }

  const tokenPayload = await tokenResponse.json();
  return { ok: true, token: tokenPayload.token };
}

async function handleReportBugStatus(request, env) {
  const allowedOrigin = getAllowedOrigin(request, env);

  if (request.method === 'OPTIONS') {
    return createJsonResponse({}, 204, allowedOrigin);
  }

  if (request.method !== 'GET') {
    return createJsonResponse({ error: 'Method not allowed' }, 405, allowedOrigin);
  }

  const hasAppId = Boolean(String(env.GITHUB_APP_ID || '').trim());
  const hasInstallationId = Boolean(String(env.GITHUB_APP_INSTALLATION_ID || '').trim());
  const hasPrivateKey = Boolean(String(env.GITHUB_APP_PRIVATE_KEY || '').trim());
  const owner = String(env.GITHUB_REPO_OWNER || '').trim();
  const repo = String(env.GITHUB_REPO_NAME || '').trim();
  const configured = hasAppId && hasInstallationId && hasPrivateKey && Boolean(owner) && Boolean(repo);

  if (!configured) {
    return createJsonResponse({
      ok: false,
      configured: false,
      missing: {
        GITHUB_APP_ID: !hasAppId,
        GITHUB_APP_INSTALLATION_ID: !hasInstallationId,
        GITHUB_APP_PRIVATE_KEY: !hasPrivateKey,
        GITHUB_REPO_OWNER: !owner,
        GITHUB_REPO_NAME: !repo
      }
    }, 200, allowedOrigin);
  }

  const tokenResult = await getInstallationAccessToken(env);
  if (!tokenResult.ok) {
    return createJsonResponse({
      ok: false,
      configured: true,
      githubAccess: 'failed',
      tokenExchangeStatus: tokenResult.status || null,
      details: tokenResult.error
    }, 200, allowedOrigin);
  }

  // Validate token + repo access without creating an issue.
  const githubResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenResult.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'petrinet-io-bug-reporter'
    }
  });

  if (!githubResponse.ok) {
    return createJsonResponse({
      ok: false,
      configured: true,
      githubAccess: 'failed',
      githubStatus: githubResponse.status
    }, 200, allowedOrigin);
  }

  return createJsonResponse({
    ok: true,
    configured: true,
    githubAccess: 'ok',
    repository: `${owner}/${repo}`
  }, 200, allowedOrigin);
}

async function handleReportBug(request, env) {
  const allowedOrigin = getAllowedOrigin(request, env);

  if (request.method === 'OPTIONS') {
    return createJsonResponse({}, 204, allowedOrigin);
  }

  if (request.method !== 'POST') {
    return createJsonResponse({ error: 'Method not allowed' }, 405, allowedOrigin);
  }

  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const tokenResult = await getInstallationAccessToken(env);

  if (!tokenResult.ok || !owner || !repo) {
    return createJsonResponse({ error: 'Server is not configured for bug reporting' }, 500, allowedOrigin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return createJsonResponse({ error: 'Invalid JSON payload' }, 400, allowedOrigin);
  }

  const title = sanitizeIssueText(payload?.title, 120);
  const description = sanitizeIssueText(payload?.description, 5000);
  const pageUrl = sanitizeIssueText(payload?.pageUrl, 500);
  const userAgent = sanitizeIssueText(payload?.userAgent, 500);

  if (!title) {
    return createJsonResponse({ error: 'Title is required' }, 400, allowedOrigin);
  }

  if (!description) {
    return createJsonResponse({ error: 'Description is required' }, 400, allowedOrigin);
  }

  const issueBody = [
    description,
    '',
    '---',
    `Reported from: ${pageUrl || 'unknown'}`,
    `User agent: ${userAgent || 'unknown'}`
  ].join('\n');

  const labels = String(env.GITHUB_ISSUE_LABELS || 'bug')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const githubResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenResult.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'petrinet-io-bug-reporter'
    },
    body: JSON.stringify({
      title,
      body: issueBody,
      labels
    })
  });

  if (!githubResponse.ok) {
    const errorText = await githubResponse.text();
    return createJsonResponse({
      error: 'Failed to create GitHub issue',
      details: errorText.slice(0, 600)
    }, 502, allowedOrigin);
  }

  const issue = await githubResponse.json();

  return createJsonResponse({
    number: issue.number,
    url: issue.html_url
  }, 201, allowedOrigin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/report-bug/status') {
      return handleReportBugStatus(request, env);
    }

    if (url.pathname === '/api/report-bug') {
      return handleReportBug(request, env);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
