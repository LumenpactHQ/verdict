process.env.NODE_ENV = 'test';

import http from 'http';
import { startServer } from '../apps/api/src/server';
import { getDb } from '../apps/api/src/db';
import {
  __setMockTransferFailure,
  __setMockTransferDelay,
  __setMockTransferCallback,
  __getTransferInvocationCount,
  __resetChainMocks,
} from '../apps/api/src/chain';

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

async function runChainResilienceSuite() {
  console.log('========================================================================');
  console.log('Verdict Security Gate: Phase 3 Chain Failure & Concurrency Test Suite');
  console.log('========================================================================\n');

  await startServer();
  const db = getDb();

  console.log('--- Test 1: Chain-Call Failure Resilience (502 & Token Unconsumed) ---');
  // 1. Evaluate an ALLOW action for Agent Alpha
  const resEval1 = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 10,
      token: 'USDC',
    },
  });

  const action1Id = resEval1.data.actionRequestId;
  const token1 = resEval1.data.authorizationToken;

  assert(
    resEval1.status === 200 && resEval1.data.decision === 'ALLOW' && token1 !== null,
    'Setup: /trust/evaluate issues valid token for Agent Alpha'
  );

  // 2. Inject simulated chain execution failure (e.g. RPC node down)
  __setMockTransferFailure(new Error('Base Sepolia RPC timeout: 504 Gateway Time-out'));

  // 3. Attempt execution while chain is failing
  const resFailedExec = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: action1Id,
      authorizationToken: token1,
    },
  });

  assert(
    resFailedExec.status === 502 &&
      resFailedExec.data.error === 'ChainExecutionError' &&
      resFailedExec.data.retryable === true &&
      resFailedExec.data.tokenConsumed === false,
    'Chain Failure Response: Returns 502 Bad Gateway with retryable: true and tokenConsumed: false'
  );

  // 4. Verify in SQLite that token was NOT consumed and status rolled back to APPROVED
  const rowAfterFailure = db
    .prepare('SELECT token_consumed, status, tx_hash FROM action_requests WHERE id = ?')
    .get(action1Id) as { token_consumed: number; status: string; tx_hash: string | null };

  assert(
    rowAfterFailure.token_consumed === 0,
    'Database Invariant: token_consumed strictly remains 0 after chain failure'
  );
  assert(
    rowAfterFailure.status === 'APPROVED',
    'Database Invariant: status rolled back to APPROVED for retryability'
  );
  assert(
    rowAfterFailure.tx_hash === null,
    'Database Invariant: tx_hash remains null'
  );

  // 5. Verify audit trail logged CHAIN_EXECUTION_FAILED
  const auditFailure = db
    .prepare("SELECT * FROM audit_trail_entries WHERE action_request_id = ? AND event_type = 'CHAIN_EXECUTION_FAILED'")
    .get(action1Id);
  assert(
    !!auditFailure,
    'Audit Invariant: CHAIN_EXECUTION_FAILED event logged in audit_trail_entries'
  );

  console.log('\n--- Test 2: Successful Retry with the Exact Same Token ---');
  // 1. Clear simulated failure (chain recovers)
  __resetChainMocks();

  // 2. Call execute again with the SAME token
  const resRetrySuccess = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: action1Id,
      authorizationToken: token1,
    },
  });

  assert(
    resRetrySuccess.status === 200 &&
      resRetrySuccess.data.status === 'EXECUTED' &&
      resRetrySuccess.data.tokenConsumed === true &&
      typeof resRetrySuccess.data.txHash === 'string',
    'Retry Success: Subsequent execute call with the same token succeeds with 200 OK and txHash'
  );

  // 3. Confirm SQLite now has token_consumed = 1
  const rowAfterSuccess = db
    .prepare('SELECT token_consumed, status, tx_hash FROM action_requests WHERE id = ?')
    .get(action1Id) as { token_consumed: number; status: string; tx_hash: string | null };

  assert(
    rowAfterSuccess.token_consumed === 1 && rowAfterSuccess.status === 'EXECUTED',
    'Database Invariant: token_consumed is now 1 and status is EXECUTED'
  );

  console.log('\n--- Test 3: Concurrency Race-Condition (Double-Execution Prevention) ---');
  // 1. Evaluate a brand-new action request
  const resEvalConcurrent = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 25,
      token: 'USDC',
    },
  });

  const concurrentActionId = resEvalConcurrent.data.actionRequestId;
  const concurrentToken = resEvalConcurrent.data.authorizationToken;

  __resetChainMocks();
  // 2. Inject 150ms artificial in-flight delay so both requests are simultaneously active
  __setMockTransferDelay(150);

  console.log('  Firing 2 simultaneous /actions/execute requests with the same valid token via Promise.all...');
  const [resConcurrentA, resConcurrentB] = await Promise.all([
    request({
      method: 'POST',
      path: '/actions/execute',
      body: {
        actionRequestId: concurrentActionId,
        authorizationToken: concurrentToken,
      },
    }),
    request({
      method: 'POST',
      path: '/actions/execute',
      body: {
        actionRequestId: concurrentActionId,
        authorizationToken: concurrentToken,
      },
    }),
  ]);

  const statuses = [resConcurrentA.status, resConcurrentB.status].sort();
  console.log(`  Concurrent request response statuses: [${resConcurrentA.status}, ${resConcurrentB.status}]`);

  // Exactly one must succeed with 200 OK, and exactly one must fail with 403 Forbidden
  assert(
    statuses[0] === 200 && statuses[1] === 403,
    'Concurrency Invariant: Exactly one request gets 200 OK and the other gets 403 Forbidden',
    `Received statuses: ${resConcurrentA.status} and ${resConcurrentB.status}`
  );

  // Assert that executeTransfer was only invoked ONCE
  const chainCallCount = __getTransferInvocationCount();
  assert(
    chainCallCount === 1,
    'Concurrency Invariant: executeTransfer was invoked exactly ONCE (no double-spend)',
    `Actual invocation count: ${chainCallCount}`
  );

  // Verify in SQLite: row is EXECUTED and token_consumed is 1
  const rowConcurrent = db
    .prepare('SELECT token_consumed, status FROM action_requests WHERE id = ?')
    .get(concurrentActionId) as { token_consumed: number; status: string };

  assert(
    rowConcurrent.token_consumed === 1 && rowConcurrent.status === 'EXECUTED',
    'Database Invariant: Final database state has token_consumed = 1 and status = EXECUTED'
  );

  console.log('\n--- Test 4: Test Hook Environment Gate ---');
  // Verify that test hooks strictly throw when NODE_ENV is not 'test'
  process.env.NODE_ENV = 'production';
  let threwInProduction = false;
  try {
    __setMockTransferFailure(new Error('This should fail'));
  } catch (err: any) {
    if (err.message.includes('Security violation')) {
      threwInProduction = true;
    }
  }
  process.env.NODE_ENV = 'test'; // restore
  __resetChainMocks();

  assert(
    threwInProduction,
    'Security Guard: Test hooks throw Security violation when NODE_ENV !== "test"'
  );

  console.log('\n--- Test 5: Finalize Step State-Integrity Check (changes === 0) ---');
  // 1. Evaluate an action to get a fresh token
  const resEval5 = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'payment',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 15,
      token: 'USDC',
    },
  });
  const actionId5 = resEval5.data.actionRequestId;
  const token5 = resEval5.data.authorizationToken;

  // 2. Set mock transfer callback to flip the row's status away from EXECUTING mid-flight (between claim and finalize)
  __setMockTransferCallback(() => {
    // Flip status to FAILED while executeTransfer is in-flight
    db.prepare("UPDATE action_requests SET status = 'FAILED' WHERE id = ?").run(actionId5);
  });

  const resFinalizeFail = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId: actionId5,
      authorizationToken: token5,
    },
  });

  __resetChainMocks();

  assert(
    resFinalizeFail.status === 500 && resFinalizeFail.data.error === 'FinalizeIntegrityError',
    'Finalize Integrity: Catches changes === 0 and returns HTTP 500 FinalizeIntegrityError',
    `Received status ${resFinalizeFail.status}, data: ${JSON.stringify(resFinalizeFail.data)}`
  );

  // Verify that FINALIZE_INTEGRITY_ERROR audit event was written
  const auditRow5 = db
    .prepare("SELECT * FROM audit_trail_entries WHERE action_request_id = ? AND event_type = 'FINALIZE_INTEGRITY_ERROR'")
    .get(actionId5) as { event_type: string; details: string } | undefined;

  assert(
    auditRow5 !== undefined,
    'Audit Trail Invariant: FINALIZE_INTEGRITY_ERROR audit trail entry was recorded in database'
  );

  let details5: any = {};
  try { details5 = JSON.parse(auditRow5?.details || '{}'); } catch {}
  assert(
    details5.foundStatus === 'FAILED' && details5.expectedStatus === 'EXECUTING',
    'Audit Details Invariant: FINALIZE_INTEGRITY_ERROR details record foundStatus=FAILED and expectedStatus=EXECUTING'
  );

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n========================================================================`);
  console.log(`Phase 3 Test Suite Summary: ${passed}/${total} checks passed.`);
  console.log(`========================================================================`);

  if (passed === total) {
    console.log('ALL CHAIN-FAILURE & CONCURRENCY CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('ONE OR MORE CHECKS FAILED!');
    process.exit(1);
  }
}

runChainResilienceSuite().catch((err) => {
  console.error('Fatal error during Phase 3 test execution:', err);
  process.exit(1);
});
