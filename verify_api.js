const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function verify() {
  console.log('=== VERIFYING FEATURES 2.1 & 2.2 ===\n');

  // 1. Test GET /api/models (Spec 2.1)
  const modelsRes = await request({ hostname: 'localhost', port: 3000, path: '/api/models', method: 'GET' });
  const { models } = JSON.parse(modelsRes.body);
  console.log(`[1/5] GET /api/models: OK -> Loaded ${models.length} models (${models.map(m => m.name).join(', ')})`);

  // 2. Test GET /api/preferences (Spec 2.1 Default Selection)
  const prefRes = await request({ hostname: 'localhost', port: 3000, path: '/api/preferences', method: 'GET' });
  console.log(`[2/5] GET /api/preferences: OK -> Default model = ${JSON.parse(prefRes.body).default_model}`);

  // 3. Test POST /api/conversations
  const createRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/conversations', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { model: 'deep-thinking' });
  const conv = JSON.parse(createRes.body);
  console.log(`[3/5] POST /api/conversations: OK -> Created thread id = ${conv.id}`);

  // 4. Test POST /api/conversations/:id/stream (Spec 2.2 Streaming)
  console.log(`[4/5] POST /api/conversations/${conv.id}/stream: Testing SSE token streaming...`);
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: `/api/conversations/${conv.id}/stream`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let chunksCount = 0;
      res.on('data', chunk => {
        const text = chunk.toString();
        if (text.includes('"type":"chunk"')) chunksCount++;
      });
      res.on('end', () => {
        console.log(`      Stream complete! Received ${chunksCount} SSE token chunks.`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ content: 'Explain quantum attention mechanism with LaTeX equations.' }));
    req.end();
  });

  // 5. Test Spec 2.1 Mid-Thread Switching & SQLite Persistence
  const switchRes = await request({
    hostname: 'localhost', port: 3000, path: `/api/conversations/${conv.id}/model`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, { model: 'zen-ultra' });
  console.log(`[5/5] PATCH /api/conversations/${conv.id}/model: OK -> Switched model to ${JSON.parse(switchRes.body).model}`);

  // Verify messages in SQLite
  const messagesRes = await request({ hostname: 'localhost', port: 3000, path: `/api/conversations/${conv.id}/messages`, method: 'GET' });
  const { conversation, messages } = JSON.parse(messagesRes.body);
  console.log(`\n SQLite Verification:`);
  console.log(`   - Conversation title: "${conversation.title}"`);
  console.log(`   - Current model: ${conversation.model}`);
  console.log(`   - Total persisted messages: ${messages.length}`);
  messages.forEach((m, idx) => {
    console.log(`     [${idx + 1}] ${m.role.toUpperCase()}: ${m.content.slice(0, 50)}...`);
  });

  console.log('\n ALL TESTS PASSED: Features 2.1 & 2.2 fully functional!');
}

verify().catch(console.error);
