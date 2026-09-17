import { startServer } from '../apps/api/src/server';

async function testSentinel() {
  const server = await startServer(4000);

  try {
    const res = await fetch('http://localhost:4000/trust/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-sentinel',
        actionType: 'PAYMENT',
        targetAddress: '0x44a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
        amount: 35,
        token: 'USDC',
      }),
    });

    const data = await res.json();
    console.log('Status Code:', res.status);
    console.log('Evaluate Response for Agent Sentinel:');
    console.log(JSON.stringify(data, null, 2));

    if (data.decision !== 'REVIEW') {
      throw new Error(`Expected decision REVIEW, got: ${data.decision}`);
    }
    if (data.authorizationToken !== null) {
      throw new Error(`Expected null token for REVIEW, got: ${data.authorizationToken}`);
    }
    console.log('\nSUCCESS: Agent Sentinel cleanly evaluated to REVIEW with stable seeded identity!');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

testSentinel().catch((err) => {
  console.error(err);
  process.exit(1);
});
