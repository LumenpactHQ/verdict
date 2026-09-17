process.env.NODE_ENV = 'test';

import http from 'http';
import { app, startServer } from '../apps/api/src/server';
import { getDb } from '../apps/api/src/db';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  PASS: ${name}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`  FAIL: ${name} - ${details}`);
  }
}

function request(options: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode || 0, data });
          } catch {
            resolve({ status: res.statusCode || 0, data: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Step 5 Contract Verification ---');

  // Start server
  await startServer();

  // Test 1: Additive GET /health
  const resHealth = await request({ method: 'GET', path: '/health' });
  assert(resHealth.status === 200 && resHealth.data.status === 'ok', 'GET /health returns 200 with status: ok');

  // Test 2: POST /agents (valid)
  const resCreateAgent = await request({
    method: 'POST',
    path: '/agents',
    body: {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      displayName: 'Test Agent',
      capabilities: ['transfer', 'swap'],
      verificationStatus: 'verified',
      transactionLimit: 500,
      reviewThreshold: 100,
    },
  });
  assert(
    resCreateAgent.status === 201 && resCreateAgent.data.displayName === 'Test Agent',
    'POST /agents returns 201 Created with Agent object'
  );

  // Test 3: POST /agents (malformed -> 400)
  const resBadAgent = await request({
    method: 'POST',
    path: '/agents',
    body: { displayName: 'Incomplete Agent' },
  });
  assert(resBadAgent.status === 400, 'POST /agents malformed payload returns 400 Bad Request');

  // Test 4: GET /agents/:id (agent-alpha -> verified)
  const resAgentAlpha = await request({ method: 'GET', path: '/agents/agent-alpha' });
  assert(
    resAgentAlpha.status === 200 && resAgentAlpha.data.verificationStatus === 'verified',
    'GET /agents/agent-alpha returns 200 verified agent'
  );

  // Test 5: GET /agents/:id (agent-shadow -> unverified)
  const resAgentShadow = await request({ method: 'GET', path: '/agents/agent-shadow' });
  assert(
    resAgentShadow.status === 200 && resAgentShadow.data.verificationStatus === 'unverified',
    'GET /agents/agent-shadow returns 200 unverified agent'
  );

  // Test 6: GET /agents/unknown -> 404
  const resAgentUnknown = await request({ method: 'GET', path: '/agents/unknown' });
  assert(resAgentUnknown.status === 404, 'GET /agents/unknown returns 404 Not Found');

  // Test 7: POST /trust/evaluate (agent-alpha -> ALLOW + token)
  const resEvalAlpha = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 5,
      token: 'USDC',
    },
  });
  const alphaActionId = resEvalAlpha.data?.actionRequestId;
  const alphaToken = resEvalAlpha.data?.authorizationToken;
  assert(
    resEvalAlpha.status === 200 &&
      resEvalAlpha.data.decision === 'ALLOW' &&
      resEvalAlpha.data.authorizationToken !== null,
    'POST /trust/evaluate for agent-alpha returns ALLOW with authorizationToken'
  );

  // Test 8: POST /trust/evaluate (agent-shadow -> REJECT + null token)
  const resEvalShadow = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-shadow',
      actionType: 'transfer',
      targetAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      amount: 500,
      token: 'USDC',
    },
  });
  assert(
    resEvalShadow.status === 200 &&
      resEvalShadow.data.decision === 'REJECT' &&
      resEvalShadow.data.authorizationToken === null &&
      resEvalShadow.data.reasons.length > 0,
    'POST /trust/evaluate for agent-shadow returns REJECT with null token and reasons'
  );

  // Test 9: POST /actions/execute (malformed body -> 400 Bad Request)
  const resExecMalformed = await request({
    method: 'POST',
    path: '/actions/execute',
    body: { actionRequestId: 'act-123' }, // missing authorizationToken
  });
  assert(resExecMalformed.status === 400, 'POST /actions/execute with missing token returns 400 Bad Request');

  // Test 10: POST /actions/execute (well-formed body, but invalid token -> 403 Forbidden)
  const resExecForbidden = await request({
    method: 'POST',
    path: '/actions/execute',
    body: { actionRequestId: alphaActionId, authorizationToken: 'invalid-or-unauthorized-token' },
  });
  assert(resExecForbidden.status === 403, 'POST /actions/execute with invalid token returns 403 Forbidden');

  // Test 11: POST /actions/execute (valid token -> 200 OK + txHash)
  const resExecSuccess = await request({
    method: 'POST',
    path: '/actions/execute',
    body: { actionRequestId: alphaActionId, authorizationToken: alphaToken },
  });
  assert(
    resExecSuccess.status === 200 &&
      resExecSuccess.data.status === 'EXECUTED' &&
      typeof resExecSuccess.data.txHash === 'string' &&
      resExecSuccess.data.txHash.startsWith('0x'),
    'POST /actions/execute with valid token returns 200 OK with txHash'
  );

  // Test 12: GET /actions (list)
  const resListActions = await request({ method: 'GET', path: '/actions' });
  assert(
    resListActions.status === 200 && Array.isArray(resListActions.data) && resListActions.data.length > 0,
    'GET /actions returns list of ActionRequest objects'
  );

  // Test 13: GET /actions/:id
  const resGetAction = await request({ method: 'GET', path: `/actions/${alphaActionId}` });
  assert(resGetAction.status === 200 && resGetAction.data.id === alphaActionId, 'GET /actions/:id returns ActionRequest');

  // Test 14: POST /actions/:id/review (evaluate a review request first, then approve = true)
  const resEvalReview = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      amount: 500,
      token: 'USDC',
    },
  });
  const reviewActionId = resEvalReview.data?.actionRequestId;

  const resReviewApprove = await request({
    method: 'POST',
    path: `/actions/${reviewActionId}/review`,
    body: { approve: true },
  });
  assert(
    resReviewApprove.status === 200 &&
      resReviewApprove.data.decision === 'ALLOW' &&
      resReviewApprove.data.authorizationToken !== null,
    'POST /actions/:id/review with approve:true returns ALLOW with fresh authorizationToken'
  );

  // Test 15: GET /docket/search?category=transfer
  const resDocket = await request({ method: 'GET', path: '/docket/search?category=transfer' });
  assert(
    resDocket.status === 200 && Array.isArray(resDocket.data) && resDocket.data.length <= 5,
    'GET /docket/search?category=transfer returns up to 5 DocketEntry objects'
  );

  // Test 16: DB Schema 5 tables verification
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);
  const expectedTables = ['action_requests', 'agent_capabilities', 'agents', 'audit_trail_entries', 'docket_entries'];
  const allTablesExist = expectedTables.every((t) => tableNames.includes(t));
  assert(
    allTablesExist,
    'SQLite database contains all 5 required tables',
    `Found: ${tableNames.join(', ')}`
  );

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\nVerification Summary: ${passed}/${total} tests passed.`);

  if (passed === total) {
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED!');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
