const GITHUB_API_BASE = 'https://api.github.com';

function createJsonResponse(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function handleReportBugStatus(request, env) {
  const allowedOrigin = getAllowedOrigin(request, env);

  if (request.method === 'OPTIONS') {
    return createJsonResponse({}, 204, allowedOrigin);
  }

  if (request.method !== 'GET') {
    return createJsonResponse({ error: 'Method not allowed' }, 405, allowedOrigin);
  }

  const hasToken = Boolean(env.GITHUB_TOKEN);
  const owner = String(env.GITHUB_REPO_OWNER || '').trim();
  const repo = String(env.GITHUB_REPO_NAME || '').trim();
  const configured = hasToken && Boolean(owner) && Boolean(repo);

  if (!configured) {
    return createJsonResponse({
      ok: false,
      configured: false,
      missing: {
        GITHUB_TOKEN: !hasToken,
        GITHUB_REPO_OWNER: !owner,
        GITHUB_REPO_NAME: !repo
      }
    }, 200, allowedOrigin);
  }

  // Validate token + repo access without creating an issue.
  const githubResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
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

  const token = env.GITHUB_TOKEN;
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
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
      'Authorization': `Bearer ${token}`,
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

    return env.ASSETS.fetch(request);
  }
};
