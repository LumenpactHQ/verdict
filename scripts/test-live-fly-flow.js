async function run() {
  const base = 'https://verdict-engine-api.fly.dev';
  console.log('1. Evaluating Sentinel transfer of 35 USDC...');
  const evalRes = await fetch(`${base}/trust/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'agent-sentinel',
      actionType: 'PAYMENT',
      targetAddress: '0x4444444444444444444444444444444444444444',
      amount: 35,
      token: 'USDC'
    })
  });
  console.log('Evaluate status:', evalRes.status);
  const evalData = await evalRes.json();
  console.log('Evaluate data:', JSON.stringify(evalData, null, 2));

  if (!evalData.actionRequestId) {
    console.error('No actionRequestId returned!');
    return;
  }

  console.log('\n2. Calling /actions/:id/review with approve: true...');
  const reviewRes = await fetch(`${base}/actions/${evalData.actionRequestId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approve: true })
  });
  console.log('Review status:', reviewRes.status);
  const reviewData = await reviewRes.json();
  console.log('Review data:', JSON.stringify(reviewData, null, 2));

  if (!reviewData.authorizationToken) {
    console.error('No authorizationToken returned from review!');
    return;
  }

  console.log('\n3. Calling /actions/execute with authorizationToken...');
  const startExec = Date.now();
  const execRes = await fetch(`${base}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actionRequestId: evalData.actionRequestId,
      authorizationToken: reviewData.authorizationToken
    })
  });
  const execTime = Date.now() - startExec;
  console.log('Execute status:', execRes.status, 'Time taken:', execTime + 'ms');
  const execData = await execRes.json();
  console.log('Execute data:', JSON.stringify(execData, null, 2));
}

run().catch(console.error);
