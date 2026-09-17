process.env.NODE_ENV = 'test';

import http from 'http';
import { startServer } from '../apps/api/src/server';
import { getDb } from '../apps/api/src/db';
import { EvaluateResult } from '@verdict/shared';

function request<T = any>(options: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ status: number; data: T }> {
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
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 0, data: raw as any });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function testReviewPath() {
  console.log('========================================================================');
  console.log('    Testing Real Engine REVIEW Paths & Docket Precedent Integration    ');
  console.log('========================================================================\n');

  await startServer();
  const db = getDb();

  // Case 1: Borderline Amount (Amount 500 USDC > soft reviewThreshold 200, <= hard transactionLimit 1000)
  console.log('--- Case 1: Borderline Amount (Between 200 and 1000 USDC) ---');
  const resBorderline = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 500,
      token: 'USDC',
    },
  });

  console.log(`[API] POST /trust/evaluate (amount=500) -> HTTP ${resBorderline.status}`);
  console.log('Response:', JSON.stringify(resBorderline.data, null, 2));

  if (resBorderline.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${resBorderline.status}`);
  }
  if (resBorderline.data.decision !== 'REVIEW') {
    throw new Error(`Expected decision: 'REVIEW', got '${resBorderline.data.decision}'`);
  }
  if (resBorderline.data.authorizationToken !== null) {
    throw new Error(`Expected authorizationToken: null, got '${resBorderline.data.authorizationToken}'`);
  }
  if (!Array.isArray(resBorderline.data.docketMatches) || resBorderline.data.docketMatches.length === 0) {
    throw new Error('Expected populated docketMatches array');
  }

  // Verify docket match shape
  const firstMatch = resBorderline.data.docketMatches[0];
  console.log('\nDocket Precedent Match:');
  console.log(JSON.stringify(firstMatch, null, 2));

  if (!firstMatch.id || !firstMatch.category || !firstMatch.summary || !firstMatch.humanDecision) {
    throw new Error('Docket match missing required fields');
  }

  // Verify SQLite row state
  const dbRow = db
    .prepare('SELECT * FROM action_requests WHERE id = ?')
    .get(resBorderline.data.actionRequestId) as any;

  console.log('\nSQLite Row Verification:');
  console.log(`  id: ${dbRow.id}`);
  console.log(`  decision: ${dbRow.decision}`);
  console.log(`  status: ${dbRow.status}`);
  console.log(`  authorization_token: ${dbRow.authorization_token}`);
  console.log(`  token_consumed: ${dbRow.token_consumed}`);

  if (dbRow.decision !== 'REVIEW' || dbRow.status !== 'PENDING' || dbRow.authorization_token !== null) {
    throw new Error('SQLite persistence mismatch for REVIEW action');
  }

  // Case 2: Unknown Recipient (Valid Amount 5 USDC, but recipient address never seen before)
  console.log('\n--- Case 2: Unknown Recipient Address ---');
  const resUnknownRecipient = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-alpha',
      actionType: 'transfer',
      targetAddress: '0x4444444444444444444444444444444444444444',
      amount: 5,
      token: 'USDC',
    },
  });

  console.log(`[API] POST /trust/evaluate (unknown recipient) -> HTTP ${resUnknownRecipient.status}`);
  console.log('Response:', JSON.stringify(resUnknownRecipient.data, null, 2));

  if (resUnknownRecipient.data.decision !== 'REVIEW') {
    throw new Error(`Expected decision: 'REVIEW', got '${resUnknownRecipient.data.decision}'`);
  }
  if (resUnknownRecipient.data.authorizationToken !== null) {
    throw new Error(`Expected authorizationToken: null, got '${resUnknownRecipient.data.authorizationToken}'`);
  }
  if (!Array.isArray(resUnknownRecipient.data.docketMatches) || resUnknownRecipient.data.docketMatches.length === 0) {
    throw new Error('Expected populated docketMatches array for unknown recipient');
  }

  console.log('\n========================================================================');
  console.log('  ALL REAL ENGINE REVIEW PATH CHECKS PASSED WITH PRECEDENT POPULATION!  ');
  console.log('========================================================================\n');
  process.exit(0);
}

testReviewPath().catch((err) => {
  console.error('REVIEW path test failed:', err);
  process.exit(1);
});
