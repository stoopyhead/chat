/**
* llm/ollamaClient.js
*
* Minimal client for a local Ollama server. Ollama is what actually runs the
* Llama 3 model on your machine — this file just talks to its HTTP API
* (http://localhost:11434 by default). No API key, no cloud call.
*
* Setup (one time, on the machine running this bot):
*   1. Install Ollama: https://ollama.com
*   2. ollama pull llama3
*   3. ollama serve   (or it's already running as a background service)
*
* Override with env vars if needed:
*   OLLAMA_HOST  - default http://localhost:11434
*   OLLAMA_MODEL - default llama3
*/

const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'llama3';

async function isAvailable() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function listModels() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/**
* Send a chat request to Ollama.
* messages: [{ role: 'system'|'user'|'assistant'|'tool', content, tool_call_id? }]
* tools:    optional Ollama-native tool schema array (passed through as-is;
*           harmless if the model doesn't support native tool calling).
*/
async function chat({ messages, tools, temperature = 0.25 }) {
  const body = {
    model: MODEL,
    messages,
    stream: false,
    // options: { temperature }
    options: {
      temperature,
      num_ctx: 4096,
      num_predict: 256
    }
  };
  if (tools && tools.length) body.tools = tools;

  let res;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000)
    });
  } catch (err) {
  const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';

  const e = new Error(
    isTimeout
      ? `Ollama was reachable, but the model took too long to respond. ` +
        `The request timed out after 300 seconds. Underlying error: ${err.message}`
      : `Could not reach Ollama at ${OLLAMA_HOST}. ` +
        `Is it installed and running? Underlying error: ${err.message}`
  );

  e.code = isTimeout ? 'OLLAMA_TIMEOUT' : 'OLLAMA_UNREACHABLE';
  throw e;
}

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = new Error(`Ollama returned ${res.status}: ${text || res.statusText}`);
    e.code = 'OLLAMA_ERROR';
    throw e;
  }

  return res.json();
}

module.exports = { chat, isAvailable, listModels, MODEL, OLLAMA_HOST };
 