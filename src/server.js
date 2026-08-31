/**
 * server.js
 *
 * Local demo server.
 *
 * - Serves the browser chat UI (src/public/).
 * - Exposes POST /api/chat, which routes every message through the LLM
 *   agent (llm/agent.js) — an Ollama/Llama 3 powered assistant that decides
 *   for itself whether it needs to call a tool (to read the mock cluster
 *   state) or can just answer directly.
 * - Exposes GET /api/status so the UI can show whether Ollama is reachable.
 * - Talks only to k8s/mockData.js and friends — no kubeconfig, no cluster,
 *   no Teams tenant, nothing to request from an admin.
 *
 * To later wire this into a real cluster: replace src/k8s/mockData.js (and
 * mockAlerts.js/mockChanges.js/mockCapacity.js) with real
 * @kubernetes/client-node calls behind the same function signatures — the
 * LLM agent and tool layer don't need to change.
 */

const path = require('path');
const express = require('express');
const agent = require('./llm/agent');
const ollama = require('./llm/ollamaClient');

const app = express();
const PORT = process.env.PORT || 3978;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Single-session in-memory conversation history (this is a local, single-user demo).
let conversationHistory = [];

app.post('/api/chat', async (req, res) => {
  const { text } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    const { reply, history, toolTrace } = await agent.handleMessage(conversationHistory, text.trim());
    conversationHistory = history;

    // Keep history bounded so the local model's context window stays sane.
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    res.json({
      reply,
      toolsUsed: toolTrace.map((t) => t.name)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Internal error: ${err.message}` });
  }
});

app.post('/api/reset', (req, res) => {
  conversationHistory = [];
  res.json({ ok: true });
});

app.get('/api/status', async (req, res) => {
  const available = await ollama.isAvailable();
  res.json({
    ok: true,
    ollama: {
      reachable: available,
      host: ollama.OLLAMA_HOST,
      model: ollama.MODEL
    }
  });
});

app.listen(PORT, () => {
  console.log(`\nOpsCopilot (Llama 3 + k8sgpt-style analysis) running locally on mock data.`);
  console.log(`Open http://localhost:${PORT} in your browser.`);
  console.log(`Using Ollama at ${ollama.OLLAMA_HOST}, model "${ollama.MODEL}".\n`);
});
