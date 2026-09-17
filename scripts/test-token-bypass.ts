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

async function runBypassSuite() {
  console.log('===============================================================');
  console.log('Verdict Security Gate: Token-Bypass Test Suite (Real SQLite DB)');
  console.log('===============================================================\n');

  await startServer();
  const db = getDb();

  // Setup: Evaluate an ALLOW request for Agent Alpha
  console.log('-> Evaluating ALLOW action for Agent Alpha...');
  const resAlphaEval = await request({
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

  const alphaActionId = resAlphaEval.data.actionRequestId;
  const alphaToken = resAlphaEval.data.authorizationToken;

  assert(
    resAlphaEval.status === 200 &&
      resAlphaEval.data.decision === 'ALLOW' &&
      typeof alphaToken === 'string' &&
      alphaToken.startsWith('vtok_'),
    'Setup: /trust/evaluate issues valid token for Agent Alpha'
  );

  // Setup: Evaluate a REJECT action for Agent Shadow
  console.log('-> Evaluating REJECT action for Agent Shadow...');
  const resShadowEval = await request({
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

  const shadowActionId = resShadowEval.data.actionRequestId;
  const shadowToken = resShadowEval.data.authorizationToken;

  assert(
    resShadowEval.status === 200 &&
      resShadowEval.data.decision === 'REJECT' &&
      shadowToken === null,
    'Setup: /trust/evaluate for Agent Shadow produces NO token (null)'
  );

  // Verify in DB that Agent Shadow row strictly has null token
  const shadowRow = db
    .prepare('SELECT authorization_token, decision FROM action_requests WHERE id = ?')
    .get(shadowActionId) as { authorization_token: string | null; decision: string };
  assert(
    shadowRow.authorization_token === null && shadowRow.decision === 'REJECT',
    'Database Invariant: REJECT action row has authorization_token = NULL in SQLite'
  );

  console.log('\n--- Test 1: Calling /actions/execute with No Token ---');
  const resNoToken = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: alphaActionId,
      // authorizationToken omitted
    },
  });
  assert(
    resNoToken.status === 400 && resNoToken.data.error === 'Bad Request',
    'Security Check 1: Missing token returns 400 Bad Request (Zod validation failure)',
    `Received status ${resNoToken.status}`
  );

  console.log('\n--- Test 2: Calling /actions/execute on a REJECT Action ---');
  // Attempt to execute Agent Shadow's rejected action using a forged/fake token
  const resRejectExec = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: shadowActionId,
      authorizationToken: 'vtok_forged_shadow_token',
    },
  });
  assert(
    resRejectExec.status === 403 && resRejectExec.data.error === 'Forbidden',
    'Security Check 2: Execution on a REJECT action is blocked with 403 Forbidden',
    `Received status ${resRejectExec.status}`
  );

  console.log('\n--- Test 3: Reused Valid Token (Double Execution) ---');
  // Call 1: Valid execution
  const resValidExec1 = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: alphaActionId,
      authorizationToken: alphaToken,
    },
  });
  assert(
    resValidExec1.status === 200 &&
      resValidExec1.data.status === 'EXECUTED' &&
      resValidExec1.data.tokenConsumed === true &&
      typeof resValidExec1.data.txHash === 'string',
    'Legitimate Execution: First call executes successfully with txHash and marks token consumed'
  );

  // Call 2: Attempt to reuse the consumed token
  const resReusedExec = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: alphaActionId,
      authorizationToken: alphaToken,
    },
  });
  assert(
    resReusedExec.status === 403 &&
      resReusedExec.data.error === 'Forbidden' &&
      resReusedExec.data.message.includes('already been consumed'),
    'Security Check 3: Reusing a valid token on second call is blocked with 403 Forbidden',
    `Received status ${resReusedExec.status}`
  );

  console.log('\n--- Test 4: Expired Token Execution ---');
  // Create an action with expired token directly in SQLite
  const expiredActionId = `act-expired-${Date.now()}`;
  const expiredToken = `vtok_expired_${Date.now()}`;
  db.prepare(`
    INSERT INTO action_requests (
      id, agent_id, action_type, target_address, amount, token,
      decision, reasons, authorization_token, token_expires_at, token_consumed,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'APPROVED', ?)
  `).run(
    expiredActionId,
    'agent-alpha',
    'transfer',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    10,
    'USDC',
    'ALLOW',
    JSON.stringify(['Pre-approved']),
    expiredToken,
    new Date(Date.now() - 10000).toISOString(), // Expired 10 seconds ago
    new Date(Date.now() - 20000).toISOString()
  );

  const resExpiredExec = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: expiredActionId,
      authorizationToken: expiredToken,
    },
  });
  assert(
    resExpiredExec.status === 403 &&
      resExpiredExec.data.error === 'Forbidden' &&
      resExpiredExec.data.message.includes('expired'),
    'Security Check 4: Calling execute after token TTL has expired is blocked with 403 Forbidden',
    `Received status ${resExpiredExec.status}`
  );

  console.log('\n--- Test 5: Token Issued for a Different actionRequestId (Isolation Verified) ---');
  // 1. Create brand-new Action A
  const resEvalA = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 20,
      token: 'USDC',
    },
  });
  const actionAId = resEvalA.data.actionRequestId;
  const tokenA = resEvalA.data.authorizationToken;

  // 2. Create brand-new Action B
  const resEvalB = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 30,
      token: 'USDC',
    },
  });
  const actionBId = resEvalB.data.actionRequestId;
  const tokenB = resEvalB.data.authorizationToken;

  // Print both independent pairs to evidence unconsumed state
  console.log(`  [Test 5 Setup] Action A: id="${actionAId}", token="${tokenA}"`);
  console.log(`  [Test 5 Setup] Action B: id="${actionBId}", token="${tokenB}"`);

  // Verify in SQLite that both are fresh and unconsumed at this exact moment
  const dbRowA = db
    .prepare('SELECT token_consumed, token_expires_at FROM action_requests WHERE id = ?')
    .get(actionAId) as { token_consumed: number; token_expires_at: string };
  const dbRowB = db
    .prepare('SELECT token_consumed, token_expires_at FROM action_requests WHERE id = ?')
    .get(actionBId) as { token_consumed: number; token_expires_at: string };

  assert(
    dbRowA.token_consumed === 0 && dbRowB.token_consumed === 0,
    'Isolation Evidence: Both Action A and Action B have token_consumed = 0 prior to mismatch call'
  );
  assert(
    new Date(dbRowA.token_expires_at).getTime() > Date.now() &&
      new Date(dbRowB.token_expires_at).getTime() > Date.now(),
    'Isolation Evidence: Both Action A and Action B tokens are unexpired prior to mismatch call'
  );

  // 3. Attempt cross-execution: Execute Action A using Token B
  const resMismatchedExec = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: actionAId,
      authorizationToken: tokenB, // Token B does not match Action A!
    },
  });
  assert(
    resMismatchedExec.status === 403 &&
      resMismatchedExec.data.error === 'Forbidden' &&
      resMismatchedExec.data.message.includes('mismatched'),
    'Security Check 5: Token issued for Action B used on Action A is blocked with 403 Forbidden (Mismatched Token)',
    `Received status ${resMismatchedExec.status}: ${JSON.stringify(resMismatchedExec.data)}`
  );

  // 4. Verify in DB that Action A's token remains unconsumed after the rejected cross-call
  const dbRowAPost = db
    .prepare('SELECT token_consumed, status FROM action_requests WHERE id = ?')
    .get(actionAId) as { token_consumed: number; status: string };
  assert(
    dbRowAPost.token_consumed === 0 && dbRowAPost.status === 'APPROVED',
    'Post-condition Evidence: Action A remains unconsumed and unaffected by the rejected call'
  );

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n===============================================================`);
  console.log(`Security Test Suite Summary: ${passed}/${total} checks passed.`);
  console.log(`===============================================================`);

  if (passed === total) {
    console.log('ALL TOKEN-BYPASS SECURITY CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('ONE OR MORE SECURITY CHECKS FAILED!');
    process.exit(1);
  }
}

runBypassSuite().catch((err) => {
  console.error('Fatal error during security test execution:', err);
  process.exit(1);
});
