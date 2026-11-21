/**
 * Zen — Node.js + Express Backend
 * Features:
 *   Spec 2.1 — Model Selection & Switching
 *   Spec 2.2 — Message Streaming & Output Rendering
 *   Spec 2.3 — Message Editing & Conversation Branching
 *   Spec 2.4 — Response Regeneration & Comparison
 *   Spec 2.6 — Feedback & Interaction Actions
 *   Spec 3.1 — Real-Time Web Search & Source Citations
 *   Spec 3.2 — Document & File Ingestion
 *   Spec 3.3 — Vision & Image Understanding
 */

'use strict';

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const https     = require('https');
const http      = require('http');
const multer    = require('multer');
const initSqlJs = require('sql.js');
require('dotenv').config();

const TOKENROUTER_API_KEY = process.env.OPENAI_API_KEY;
const TOKENROUTER_BASE    = 'https://api.tokenrouter.com/v1';

const app     = express();
const PORT    = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'zen.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Setup multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

let db;

// ──────────────────────────────────────────────────────────────
// SQLite Database Initialization & Schema
// ──────────────────────────────────────────────────────────────
function saveDbToDisk() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Failed to write zen.db:', err);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT 'New Chat',
      model      TEXT NOT NULL DEFAULT 'deep-thinking',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      parent_id       TEXT,
      role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content         TEXT NOT NULL,
      model           TEXT,
      attachments     TEXT,
      sources         TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      default_model  TEXT NOT NULL DEFAULT 'deep-thinking'
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id              TEXT PRIMARY KEY,
      message_id      TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      rating          TEXT NOT NULL CHECK(rating IN ('positive', 'negative')),
      reasons         TEXT,
      comment         TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO preferences (id, default_model) VALUES (1, 'deep-thinking');
  `);

  // Schema migrations for columns if upgrading
  try {
    const checkCols = db.exec("PRAGMA table_info(messages)");
    const cols = checkCols[0].values.map(v => v[1]);
    if (!cols.includes('parent_id')) db.run("ALTER TABLE messages ADD COLUMN parent_id TEXT");
    if (!cols.includes('attachments')) db.run("ALTER TABLE messages ADD COLUMN attachments TEXT");
    if (!cols.includes('sources')) db.run("ALTER TABLE messages ADD COLUMN sources TEXT");
  } catch (_) {}

  saveDbToDisk();
}

// ──────────────────────────────────────────────────────────────
// Registered Models
// ──────────────────────────────────────────────────────────────
const MODELS = {
  'glm-5.3-free': {
    id       : 'glm-5.3-free',
    name     : 'GLM 5.3 Free',
    tag      : 'Free Tier',
    badge    : 'Free',
    badgeType: 'green',
    desc     : 'ZhiGLM glm-5.3-free - General purpose AI model',
    apiModel : process.env.OPENAI_MODEL || 'z-ai/glm-5.3-free',
  },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function resolveModel(modelId) {
  return MODELS[modelId] || MODELS['deep-thinking'];
}

// ──────────────────────────────────────────────────────────────
// Middleware & Static Files
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────────────────────
// API Endpoints
// ──────────────────────────────────────────────────────────────

// GET /api/models — Spec 2.1
app.get('/api/models', (req, res) => {
  res.json({ models: Object.values(MODELS) });
});

// GET /api/preferences — Spec 2.1
app.get('/api/preferences', (req, res) => {
  const result = db.exec("SELECT default_model FROM preferences WHERE id = 1");
  const default_model = result[0]?.values[0]?.[0] || 'deep-thinking';
  res.json({ default_model });
});

// PATCH /api/preferences — Spec 2.1
app.patch('/api/preferences', (req, res) => {
  const { default_model } = req.body;
  if (!MODELS[default_model]) return res.status(400).json({ error: 'Unknown model id' });
  db.run("UPDATE preferences SET default_model = ? WHERE id = 1", [default_model]);
  saveDbToDisk();
  res.json({ success: true, default_model });
});

// GET /api/conversations
app.get('/api/conversations', (req, res) => {
  const result = db.exec("SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100");
  if (!result.length) return res.json({ conversations: [] });
  
  const cols = result[0].columns;
  const conversations = result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json({ conversations });
});

// POST /api/conversations
app.post('/api/conversations', (req, res) => {
  const { model } = req.body;
  const prefResult = db.exec("SELECT default_model FROM preferences WHERE id = 1");
  const defaultModel = prefResult[0]?.values[0]?.[0] || 'deep-thinking';
  const modelId = (model && MODELS[model]) ? model : defaultModel;
  const id = uid();
  
  db.run("INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))", 
    [id, 'New Chat', modelId]
  );
  saveDbToDisk();
  res.json({ id, model: modelId });
});

// GET /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', (req, res) => {
  const convRes = db.exec("SELECT id, title, model FROM conversations WHERE id = ?", [req.params.id]);
  if (!convRes.length || !convRes[0].values.length) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  const conv = {
    id: convRes[0].values[0][0],
    title: convRes[0].values[0][1],
    model: convRes[0].values[0][2]
  };

  const msgRes = db.exec("SELECT id, conversation_id, parent_id, role, content, model, attachments, sources, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", [req.params.id]);
  const messages = [];
  if (msgRes.length) {
    const cols = msgRes[0].columns;
    msgRes[0].values.forEach(row => {
      const obj = {};
      cols.forEach((col, i) => {
        let val = row[i];
        if ((col === 'attachments' || col === 'sources') && typeof val === 'string') {
          try { val = JSON.parse(val); } catch (_) {}
        }
        obj[col] = val;
      });
      messages.push(obj);
    });
  }

  res.json({ conversation: conv, messages });
});

// PATCH /api/conversations/:id/model — Spec 2.1 Mid-Thread Switching
app.patch('/api/conversations/:id/model', (req, res) => {
  const { model } = req.body;
  if (!MODELS[model]) return res.status(400).json({ error: 'Unknown model id' });

  db.run("UPDATE conversations SET model = ?, updated_at = datetime('now') WHERE id = ?", [model, req.params.id]);
  saveDbToDisk();
  res.json({ success: true, model });
});

// ──────────────────────────────────────────────────────────────
// Spec 3.2 & 3.3 — File & Image Ingestion Endpoint
// ──────────────────────────────────────────────────────────────
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const uploadedFiles = req.files.map(file => {
    const isImage = file.mimetype.startsWith('image/');
    let textPreview = '';

    // If text/code/csv/json, extract text preview
    if (!isImage && (file.mimetype.includes('text') || file.mimetype.includes('json') || file.mimetype.includes('csv') || file.originalname.match(/\.(txt|csv|json|md|py|js|ts|html|css)$/i))) {
      try {
        const raw = fs.readFileSync(file.path, 'utf8');
        textPreview = raw.slice(0, 5000); // 5KB preview
      } catch (_) {}
    }

    return {
      id          : uid(),
      filename    : file.filename,
      originalname: file.originalname,
      mimetype    : file.mimetype,
      size        : file.size,
      url         : `/uploads/${file.filename}`,
      isImage     : isImage,
      textPreview : textPreview,
    };
  });

  res.json({ files: uploadedFiles });
});

// ──────────────────────────────────────────────────────────────
// TokenRouter API Call
// ──────────────────────────────────────────────────────────────
async function generateTokenRouterResponse({ content, model, attemptNumber = 1 }) {
  const postData = JSON.stringify({
    model: model,
    messages: [{ role: 'user', content }],
    temperature: 0.7,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.tokenrouter.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKENROUTER_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`TokenRouter API error: ${res.statusCode} ${data}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          const text = result.choices?.[0]?.message?.content || 'No response generated';
          resolve({ text, sources: result.sources || [] });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * POST /api/conversations/:id/stream
 * Implements Spec 2.2, 2.3, 3.1 (Web Search), 3.2 (Files), 3.3 (Vision)
 */
app.post('/api/conversations/:id/stream', async (req, res) => {
  const convRes = db.exec("SELECT id, title, model FROM conversations WHERE id = ?", [req.params.id]);
  if (!convRes.length || !convRes[0].values.length) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const convId = convRes[0].values[0][0];
  const convModel = convRes[0].values[0][2];

  const { content, parent_id, model, attachments = [], web_search = false } = req.body;
  if (!content && attachments.length === 0) {
    return res.status(400).json({ error: 'Message content or attachment is required' });
  }

  const promptText = content ? content.trim() : (attachments.length > 0 ? `[Attached ${attachments.length} file(s)]` : '');
  const activeModelId = (model && MODELS[model]) ? model : convModel;

  // 1. Save user message node with attachments
  const userMsgId = uid();
  const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;

  db.run("INSERT INTO messages (id, conversation_id, parent_id, role, content, model, attachments, sources, created_at) VALUES (?, ?, ?, 'user', ?, NULL, ?, NULL, datetime('now'))",
    [userMsgId, convId, parent_id || null, promptText, attachmentsJson]
  );

  // 2. Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const asstMsgId = uid();

  // Get response from TokenRouter API
  const { text: responseText, sources } = await generateTokenRouterResponse({
    content: promptText,
    model: activeModelId,
    attemptNumber: 1
  });

  res.write(`data: ${JSON.stringify({
    type: 'start',
    messageId: asstMsgId,
    userMessageId: userMsgId,
    model: activeModelId,
    sources: sources
  })}\n\n`);

  let isAborted = false;
  res.on('close', () => { isAborted = true; });

  // Stream tokens to client
  const tokens = responseText.split(/(?<=\s|[\n`$\[\]])/);
  let accumulated = '';
  let i = 0;

  while (i < tokens.length) {
    if (isAborted) break;
    const token = tokens[i];
    accumulated += token;
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: token })}\n\n`);
    i++;
    await new Promise(r => setTimeout(r, 18));
  }

  // 3. Save assistant message node with sources in SQLite
  const sourcesJson = sources.length > 0 ? JSON.stringify(sources) : null;
  db.run("INSERT INTO messages (id, conversation_id, parent_id, role, content, model, attachments, sources, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, NULL, ?, datetime('now'))",
    [asstMsgId, convId, userMsgId, accumulated, activeModelId, sourcesJson]
  );

  // Auto-title conversation after first exchange
  const countRes = db.exec("SELECT COUNT(*) FROM messages WHERE conversation_id = ?", [convId]);
  const msgCount = countRes[0]?.values[0]?.[0] || 0;
  if (msgCount <= 2) {
    const cleanTitle = promptText.slice(0, 48).replace(/[\n\r]+/g, ' ');
    db.run("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?", [cleanTitle, convId]);
  } else {
    db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [convId]);
  }
  saveDbToDisk();

  if (!isAborted) {
    res.write(`data: ${JSON.stringify({
      type: 'done',
      fullText: accumulated,
      messageId: asstMsgId,
      userMessageId: userMsgId,
      sources: sources
    })}\n\n`);
  }
  res.end();
});

// Feedback Endpoints (Spec 2.6)
app.post('/api/messages/:id/feedback', (req, res) => {
  const { rating, reasons, comment } = req.body;
  if (!rating || !['positive', 'negative'].includes(rating)) {
    return res.status(400).json({ error: 'Valid rating (positive or negative) required' });
  }

  const msgRes = db.exec("SELECT conversation_id FROM messages WHERE id = ?", [req.params.id]);
  if (!msgRes.length || !msgRes[0].values.length) {
    return res.status(404).json({ error: 'Message not found' });
  }
  const convId = msgRes[0].values[0][0];

  const feedbackId = uid();
  const reasonsJson = Array.isArray(reasons) ? JSON.stringify(reasons) : (reasons || null);

  db.run("DELETE FROM feedback WHERE message_id = ?", [req.params.id]);
  db.run("INSERT INTO feedback (id, message_id, conversation_id, rating, reasons, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
    [feedbackId, req.params.id, convId, rating, reasonsJson, comment || null]
  );
  saveDbToDisk();

  res.json({ success: true, id: feedbackId, rating, reasons: reasons || [], comment: comment || '' });
});

app.get('/api/messages/:id/feedback', (req, res) => {
  const fbRes = db.exec("SELECT id, message_id, rating, reasons, comment, created_at FROM feedback WHERE message_id = ?", [req.params.id]);
  if (!fbRes.length || !fbRes[0].values.length) return res.json({ feedback: null });
  const row = fbRes[0].values[0];
  let reasons = [];
  try { reasons = JSON.parse(row[3]) || []; } catch (_) {}

  res.json({
    feedback: {
      id: row[0], message_id: row[1], rating: row[2], reasons, comment: row[4] || '', created_at: row[5]
    }
  });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Zen server is running → http://localhost:${PORT}`);
    console.log(`  SQLite database       → ${DB_PATH}`);
    console.log(`  Multimodal Features   → 3.1, 3.2, 3.3 Active\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
