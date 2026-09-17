import http from 'http';

interface EvaluateResponse {
  actionRequestId?: string;
  decision?: string;
  reasons?: string[];
  authorizationToken?: string | null;
  docketMatches?: unknown[];
}

interface RunResult {
  run: number;
  durationMs: number;
  decision: string;
  expectedDecision: string;
  tokenValid: boolean;
  passed: boolean;
  failureReason?: string;
}

const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.PORT || 4000);
const TIMEOUT_MS = 3000;
const REPETITIONS = 10;

function sendPostEvaluate(payload: Record<string, unknown>): Promise<{ status: number; data: EvaluateResponse; durationMs: number }> {
  const bodyString = JSON.stringify(payload);
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        path: '/trust/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
        },
        timeout: TIMEOUT_MS + 1000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          try {
            const data = raw ? JSON.parse(raw) : {};
            resolve({ status: res.statusCode || 0, data, durationMs });
          } catch {
            resolve({ status: res.statusCode || 0, data: { decision: 'PARSE_ERROR' }, durationMs });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      reject({ err, durationMs });
    });

    req.write(bodyString);
    req.end();
  });
}

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    const probe = http.get(
      {
        hostname: API_HOST,
        port: API_PORT,
        path: '/health',
        timeout: 1000,
      },
      (res) => {
        res.resume(); // Discard stream to release handle
        resolve();
      }
    );

    probe.on('timeout', () => {
      probe.destroy();
    });

    probe.on('error', async () => {
      console.log(`[Reliability Test] Server not detected on http://${API_HOST}:${API_PORT}. Starting in-process server...`);
      try {
        const { startServer } = await import('../apps/api/src/server');
        await startServer();
        console.log(`[Reliability Test] Server started successfully.`);
        resolve();
      } catch (e) {
        console.error('[Reliability Test] Failed to start server:', e);
        resolve();
      }
    });
  });
}

async function runReliabilityTests() {
  console.log('========================================================================');
  console.log('   VERDICT DEMO FLOW RELIABILITY TEST (10 CONSECUTIVE RUNS PER AGENT)');
  console.log('========================================================================\n');

  await ensureServerRunning();

  // Known request for Agent Alpha (Verified agent, 5 USDC transfer)
  const alphaPayload = {
    agentId: 'agent-alpha',
    actionType: 'transfer',
    targetAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: 5,
    token: 'USDC',
  };

  // Known request for Agent Shadow (Unverified agent, suspicious transfer)
  const shadowPayload = {
    agentId: 'agent-shadow',
    actionType: 'transfer',
    targetAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    amount: 500,
    token: 'USDC',
  };

  const alphaResults: RunResult[] = [];
  const shadowResults: RunResult[] = [];

  // ─── 1. Test Agent Alpha (10 runs) ──────────────────────────────────────────
  console.log('------------------------------------------------------------------------');
  console.log('1. Testing Agent Alpha: POST /trust/evaluate (Expected: ALLOW, Token, <3s)');
  console.log('------------------------------------------------------------------------');

  for (let i = 1; i <= REPETITIONS; i++) {
    try {
      const res = await sendPostEvaluate(alphaPayload);
      const isDecisionMatch = res.data.decision === 'ALLOW';
      const isTokenPresent = typeof res.data.authorizationToken === 'string' && res.data.authorizationToken.length > 0;
      const isWithinTime = res.durationMs <= TIMEOUT_MS;

      const passed = isDecisionMatch && isTokenPresent && isWithinTime;
      let failureReason: string | undefined;

      if (!isDecisionMatch) {
        failureReason = `Decision mismatch (expected ALLOW, got '${res.data.decision}')`;
      } else if (!isTokenPresent) {
        failureReason = `Missing authorizationToken (expected valid token, got '${res.data.authorizationToken}')`;
      } else if (!isWithinTime) {
        failureReason = `Response time exceeded 3s limit (took ${res.durationMs}ms > ${TIMEOUT_MS}ms)`;
      }

      alphaResults.push({
        run: i,
        durationMs: res.durationMs,
        decision: res.data.decision || 'UNKNOWN',
        expectedDecision: 'ALLOW',
        tokenValid: isTokenPresent,
        passed,
        failureReason,
      });

      if (passed) {
        console.log(
          `  Run ${i.toString().padStart(2, ' ')}/10: PASS | Time: ${res.durationMs.toString().padStart(3, ' ')}ms | Decision: ALLOW | Token: ${res.data.authorizationToken?.slice(0, 16)}...`
        );
      } else {
        console.error(
          `  FAILURE: Run ${i}/10 - ${failureReason} | Time: ${res.durationMs}ms | Decision: ${res.data.decision}`
        );
      }
    } catch (err: any) {
      const durationMs = err.durationMs || 0;
      const failureReason = `Network/Execution Error: ${err.err?.message || err}`;
      alphaResults.push({
        run: i,
        durationMs,
        decision: 'ERROR',
        expectedDecision: 'ALLOW',
        tokenValid: false,
        passed: false,
        failureReason,
      });
      console.error(`  FAILURE: Run ${i}/10 - ${failureReason} (took ${durationMs}ms)`);
    }
  }

  console.log();

  // ─── 2. Test Agent Shadow (10 runs) ─────────────────────────────────────────
  console.log('------------------------------------------------------------------------');
  console.log('2. Testing Agent Shadow: POST /trust/evaluate (Expected: REJECT, Token: null, <3s)');
  console.log('------------------------------------------------------------------------');

  for (let i = 1; i <= REPETITIONS; i++) {
    try {
      const res = await sendPostEvaluate(shadowPayload);
      const isDecisionMatch = res.data.decision === 'REJECT';
      const isTokenNull = res.data.authorizationToken === null || res.data.authorizationToken === undefined;
      const isWithinTime = res.durationMs <= TIMEOUT_MS;

      const passed = isDecisionMatch && isTokenNull && isWithinTime;
      let failureReason: string | undefined;

      if (!isDecisionMatch) {
        failureReason = `Decision mismatch (expected REJECT, got '${res.data.decision}')`;
      } else if (!isTokenNull) {
        failureReason = `Security breach: authorizationToken present on REJECT ('${res.data.authorizationToken}')`;
      } else if (!isWithinTime) {
        failureReason = `Response time exceeded 3s limit (took ${res.durationMs}ms > ${TIMEOUT_MS}ms)`;
      }

      shadowResults.push({
        run: i,
        durationMs: res.durationMs,
        decision: res.data.decision || 'UNKNOWN',
        expectedDecision: 'REJECT',
        tokenValid: isTokenNull,
        passed,
        failureReason,
      });

      if (passed) {
        console.log(
          `  Run ${i.toString().padStart(2, ' ')}/10: PASS | Time: ${res.durationMs.toString().padStart(3, ' ')}ms | Decision: REJECT | Token: null (confirmed)`
        );
      } else {
        console.error(
          `  FAILURE: Run ${i}/10 - ${failureReason} | Time: ${res.durationMs}ms | Decision: ${res.data.decision}`
        );
      }
    } catch (err: any) {
      const durationMs = err.durationMs || 0;
      const failureReason = `Network/Execution Error: ${err.err?.message || err}`;
      shadowResults.push({
        run: i,
        durationMs,
        decision: 'ERROR',
        expectedDecision: 'REJECT',
        tokenValid: false,
        passed: false,
        failureReason,
      });
      console.error(`  FAILURE: Run ${i}/10 - ${failureReason} (took ${durationMs}ms)`);
    }
  }

  // ─── 3. Final Summary ───────────────────────────────────────────────────────
  console.log('\n========================================================================');
  console.log('   FINAL RELIABILITY SUMMARY');
  console.log('========================================================================');

  const alphaPassedCount = alphaResults.filter((r) => r.passed).length;
  const shadowPassedCount = shadowResults.filter((r) => r.passed).length;

  const alphaSummary =
    alphaPassedCount === REPETITIONS
      ? `Alpha: ${alphaPassedCount}/${REPETITIONS} passed`
      : `Alpha: ${alphaPassedCount}/${REPETITIONS} passed — see failures above.`;

  const shadowSummary =
    shadowPassedCount === REPETITIONS
      ? `Shadow: ${shadowPassedCount}/${REPETITIONS} passed`
      : `Shadow: ${shadowPassedCount}/${REPETITIONS} passed — see failures above.`;

  console.log(alphaSummary);
  console.log(shadowSummary);

  const avgAlphaTime = Math.round(alphaResults.reduce((acc, r) => acc + r.durationMs, 0) / REPETITIONS);
  const avgShadowTime = Math.round(shadowResults.reduce((acc, r) => acc + r.durationMs, 0) / REPETITIONS);
  console.log(`Average Latency: Alpha = ${avgAlphaTime}ms | Shadow = ${avgShadowTime}ms`);
  console.log('========================================================================\n');

  if (alphaPassedCount === REPETITIONS && shadowPassedCount === REPETITIONS) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runReliabilityTests().catch((err) => {
  console.error('[Reliability Test] Unhandled error:', err);
  process.exit(1);
});
