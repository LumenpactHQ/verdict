import http from 'http';

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

async function testSentinelApprovalFlow() {
  console.log('========================================================================');
  console.log('   Testing Sentinel REVIEW -> Human Approve -> Execute -> TxHash Flow   ');
  console.log('========================================================================\n');

  // Step 1: POST /trust/evaluate for agent-sentinel ($35 payment exceeds $25 threshold)
  console.log('>>> Step 1: Evaluating Agent Sentinel with $35 Payment...');
  const evalRes = await request({
    method: 'POST',
    path: '/trust/evaluate',
    body: {
      agentId: 'agent-sentinel',
      actionType: 'payment',
      targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 35,
      token: 'USDC',
    },
  });

  console.log(`    Status: HTTP ${evalRes.status}, Decision: ${evalRes.data.decision}`);
  console.log(`    ActionRequestId: ${evalRes.data.actionRequestId}`);
  console.log(`    Reasons: ${JSON.stringify(evalRes.data.reasons)}`);
  console.log(`    AuthorizationToken: ${evalRes.data.authorizationToken}`);

  if (evalRes.status !== 200 || evalRes.data.decision !== 'REVIEW') {
    throw new Error(`Expected REVIEW decision for Sentinel, got: ${evalRes.data.decision}`);
  }
  if (evalRes.data.authorizationToken !== null) {
    throw new Error(`Expected null token for REVIEW decision, got: ${evalRes.data.authorizationToken}`);
  }

  const actionRequestId = evalRes.data.actionRequestId;

  // Step 2: POST /actions/:id/review with { approve: true }
  console.log('\n>>> Step 2: Human reviewer approves request on Docket (/actions/:id/review)...');
  const reviewRes = await request({
    method: 'POST',
    path: `/actions/${actionRequestId}/review`,
    body: { approve: true },
  });

  console.log(`    Status: HTTP ${reviewRes.status}, Decision: ${reviewRes.data.decision}`);
  console.log(`    Action State: ${reviewRes.data.status}`);
  console.log(`    Fresh Token Issued: ${reviewRes.data.authorizationToken}`);

  if (reviewRes.status !== 200 || reviewRes.data.decision !== 'ALLOW' || reviewRes.data.status !== 'APPROVED') {
    throw new Error(`Expected status 'APPROVED' and decision 'ALLOW', got status '${reviewRes.data.status}'`);
  }
  if (!reviewRes.data.authorizationToken?.startsWith('vtok_')) {
    throw new Error(`Expected fresh vtok_ token, got: ${reviewRes.data.authorizationToken}`);
  }

  const freshToken = reviewRes.data.authorizationToken;

  // Step 3: Automatically execute on /actions/execute with the fresh token (Frontend fix)
  console.log('\n>>> Step 3: Frontend automatically executes fresh token on /actions/execute...');
  const execRes = await request({
    method: 'POST',
    path: '/actions/execute',
    body: {
      actionRequestId,
      authorizationToken: freshToken,
    },
  });

  console.log(`    Status: HTTP ${execRes.status}, Action State: ${execRes.data.status}`);
  console.log(`    Transaction Hash: ${execRes.data.txHash}`);

  if (execRes.status !== 200 || execRes.data.status !== 'EXECUTED' || !execRes.data.txHash?.startsWith('0x')) {
    throw new Error(`Expected 200 EXECUTED with valid txHash, got status ${execRes.status}, txHash ${execRes.data.txHash}`);
  }

  // Step 4: Verify full action record and audit trail via GET /actions/:id
  console.log('\n>>> Step 4: Verifying full audit trail on GET /actions/:id...');
  const detailRes = await request({
    method: 'GET',
    path: `/actions/${actionRequestId}`,
  });

  const auditEvents = detailRes.data.auditTrail.map((e: any) => e.eventType);
  console.log(`    Audit Events: ${JSON.stringify(auditEvents)}`);

  if (!auditEvents.includes('EVALUATE_ACTION') || !auditEvents.includes('HUMAN_REVIEW') || !auditEvents.includes('ACTION_EXECUTED')) {
    throw new Error(`Expected EVALUATE_ACTION, HUMAN_REVIEW, ACTION_EXECUTED in audit trail, got: ${JSON.stringify(auditEvents)}`);
  }

  console.log('\n========================================================================');
  console.log('   ALL SENTINEL REVIEW -> APPROVE -> EXECUTE FLOW CHECKS PASSED!        ');
  console.log(`   Final Confirmed txHash: ${execRes.data.txHash}`);
  console.log('========================================================================\n');
}

testSentinelApprovalFlow().catch((err) => {
  console.error('Sentinel approval test failed:', err);
  process.exit(1);
});
