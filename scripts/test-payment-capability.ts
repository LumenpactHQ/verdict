process.env.NODE_ENV = 'test';

import http from 'http';
import { startServer } from '../apps/api/src/server';
import { getDb } from '../apps/api/src/db';
import { EvaluateResult } from '@verdict/shared';

function request<T = any>(options: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ status: number; data: T; durationMs: number }> {
  const startTime = Date.now();
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
          const durationMs = Date.now() - startTime;
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw), durationMs });
          } catch {
            resolve({ status: res.statusCode || 0, data: raw as any, durationMs });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function testPaymentCapability() {
  console.log('========================================================================');
  console.log("   Regression Test: Case-Insensitive 'PAYMENT' Capability Matching       ");
  console.log('========================================================================\n');

  await startServer();
  const db = getDb();

  // Re-seed DB to pick up any new seed definitions
  const { seedAgents } = await import('../apps/api/src/db/seed');
  seedAgents(db);

  // Exact request payload sent by P4 Trust Check component (uppercase 'PAYMENT')
  const payload = {
    agentId: 'agent-alpha',
    actionType: 'PAYMENT',
    targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: 5,
    token: 'USDC',
  };

  console.log('>>> Sending POST /trust/evaluate with actionType: "PAYMENT"...');
  console.log('Request Payload:', JSON.stringify(payload, null, 2));

  const res = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: payload,
  });

  console.log(`\nResponse (HTTP ${res.status}, ${res.durationMs}ms):`);
  console.log(JSON.stringify(res.data, null, 2));

  // Assertions
  if (res.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${res.status}`);
  }
  if (res.data.decision !== 'ALLOW') {
    throw new Error(`Expected decision: 'ALLOW', got '${res.data.decision}' with reasons: ${JSON.stringify(res.data.reasons)}`);
  }
  if (!res.data.authorizationToken?.startsWith('vtok_')) {
    throw new Error(`Expected valid vtok_ authorizationToken, got: ${res.data.authorizationToken}`);
  }

  // Also test uppercase 'TRANSFER' and lowercase 'payment' to ensure complete case-insensitivity
  console.log('\n>>> Testing uppercase "TRANSFER"...');
  const resUpperTransfer = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: { ...payload, actionType: 'TRANSFER' },
  });
  if (resUpperTransfer.data.decision !== 'ALLOW') {
    throw new Error(`Expected decision: 'ALLOW' for 'TRANSFER', got '${resUpperTransfer.data.decision}'`);
  }
  console.log('  PASS: Uppercase "TRANSFER" evaluated to ALLOW');

  console.log('\n>>> Testing lowercase "payment"...');
  const resLowerPayment = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: { ...payload, actionType: 'payment' },
  });
  if (resLowerPayment.data.decision !== 'ALLOW') {
    throw new Error(`Expected decision: 'ALLOW' for 'payment', got '${resLowerPayment.data.decision}'`);
  }
  console.log('  PASS: Lowercase "payment" evaluated to ALLOW');

  // Negative test: verify that an unauthorized capability STILL rejects
  console.log('\n>>> Testing unauthorized capability "LIQUIDATE"...');
  const resUnauthorized = await request<EvaluateResult>({
    method: 'POST',
    path: '/trust/evaluate',
    body: { ...payload, actionType: 'LIQUIDATE' },
  });
  if (resUnauthorized.data.decision !== 'REJECT') {
    throw new Error(`Expected decision: 'REJECT' for 'LIQUIDATE', got '${resUnauthorized.data.decision}'`);
  }
  console.log(`  PASS: Unauthorized capability "LIQUIDATE" rejected with: ${JSON.stringify(resUnauthorized.data.reasons)}`);

  console.log('\n========================================================================');
  console.log("   ALL 'PAYMENT' / 'TRANSFER' CAPABILITY REGRESSION CHECKS PASSED!      ");
  console.log('========================================================================\n');
  process.exit(0);
}

testPaymentCapability().catch((err) => {
  console.error('Capability regression test failed:', err);
  process.exit(1);
});
