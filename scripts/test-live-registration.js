const API = 'https://verdict-engine-api.fly.dev';

async function main() {
  console.log('--- Testing Self-Service Agent Registration on Live Fly.io ---');

  // 1. Register new agent
  const agentPayload = {
    displayName: 'Solaris Arbiter',
    walletAddress: '0x9182736450192837465019283746501928374650',
    capabilities: ['payment'],
    verificationStatus: 'verified',
    transactionLimit: 200,
    reviewThreshold: 50,
  };

  const regRes = await fetch(`${API}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentPayload),
  });
  const agent = await regRes.json();
  console.log('1. Agent Registered:', agent.id, agent.displayName, 'Limit:', agent.transactionLimit, 'Threshold:', agent.reviewThreshold);

  // 2. Test ALLOW: 25 USDC payment (within limit & review threshold, capability declared)
  const evalAllowRes = await fetch(`${API}/trust/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: agent.id,
      actionType: 'PAYMENT',
      targetAddress: '0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91',
      amount: 25,
      token: 'USDC',
    }),
  });
  const allowData = await evalAllowRes.json();
  console.log('2. Test ALLOW outcome:', allowData.decision, '| Reasons:', allowData.reasons, '| Token:', allowData.authorizationToken ? 'ISSUED' : 'NONE');

  // 3. Test REVIEW: 75 USDC payment (exceeds reviewThreshold of 50)
  const evalReviewRes = await fetch(`${API}/trust/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: agent.id,
      actionType: 'PAYMENT',
      targetAddress: '0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91',
      amount: 75,
      token: 'USDC',
    }),
  });
  const reviewData = await evalReviewRes.json();
  console.log('3. Test REVIEW outcome:', reviewData.decision, '| Reasons:', reviewData.reasons);

  // 4. Test REJECT: SWAP action (agent only has payment capability)
  const evalRejectRes = await fetch(`${API}/trust/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: agent.id,
      actionType: 'SWAP',
      targetAddress: '0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91',
      amount: 25,
      token: 'USDC',
    }),
  });
  const rejectData = await evalRejectRes.json();
  console.log('4. Test REJECT outcome (missing capability):', rejectData.decision, '| Reasons:', rejectData.reasons);

  // 5. Test GUARDRAIL: Attempt to execute ALLOW token on /actions/execute for non-demo agent
  console.log('5. Testing Guardrail on /actions/execute for non-demo agent...');
  const execRes = await fetch(`${API}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actionRequestId: allowData.actionRequestId,
      authorizationToken: allowData.authorizationToken,
    }),
  });
  const execStatus = execRes.status;
  const execData = await execRes.json();
  console.log('Execution HTTP Status:', execStatus);
  console.log('Execution Response:', execData);
}

main().catch(console.error);
