const https = require('https');

async function get(url) {
  const res = await fetch(url);
  return res.text();
}

async function run() {
  const html = await get('https://verdict-web-pink.vercel.app/trust-check');
  const regex = /src="(\/_next\/static\/chunks\/[^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const chunkPath = match[1];
    const js = await get('https://verdict-web-pink.vercel.app' + chunkPath);
    if (js.includes('localhost:4000') || js.includes('verdict-engine-api.fly.dev')) {
      console.log('Chunk:', chunkPath);
      if (js.includes('localhost:4000')) console.log('  FOUND localhost:4000');
      if (js.includes('verdict-engine-api.fly.dev')) console.log('  FOUND verdict-engine-api.fly.dev');
    }
  }
}

run().catch(console.error);
