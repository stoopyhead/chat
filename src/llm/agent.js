/**
 * llm/agent.js
 *
 * The "brain": a small tool-calling loop around Ollama/Llama 3. This
 * replaces the old fixed command router — every message goes through the
 * model, which decides on its own whether it needs to call a tool (to get
 * real environment data) or can just answer directly (general questions,
 * small talk, DevOps knowledge).
 *
 * Supports two tool-calling styles so it works with whichever model is
 * pulled:
 *   1. Native Ollama function calling (message.tool_calls) — used by
 *      models like llama3.1/3.2, mistral-nemo, etc.
 *   2. A JSON-fallback convention (see systemPrompt.js) for base llama3,
 *      which doesn't reliably support native tool calling.
 */

const ollama = require('./ollamaClient');
const tools = require('./tools');
const { SYSTEM_PROMPT } = require('./systemPrompt');

const MAX_TOOL_ITERATIONS = 6;

function tryParseFallbackToolCall(content) {
  if (!content) return null;
  const trimmed = content.trim();

  // Accept either a bare JSON object or one wrapped in a ```json fence.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;

  if (!candidate.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && parsed.tool_call && parsed.tool_call.name) {
      return parsed.tool_call;
    }
  } catch {
    // Not a tool call — just normal prose.
  }
  return null;
}

/**
 * Run one turn of the conversation.
 * history: prior [{role, content}] messages (no system prompt included).
 * userMessage: latest user text.
 * Returns { reply, history: updatedHistory, toolTrace }.
 */
async function handleMessage(history, userMessage) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const toolTrace = [];
  let finalReply = null;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let response;
    try {
      response = await ollama.chat({ messages, tools: tools.TOOL_SCHEMAS });
    } catch (err) {
      finalReply =
        err.code === 'OLLAMA_UNREACHABLE'
          ? `I can't reach the local AI model right now. Make sure Ollama is running and the model is pulled:\n\n\`\`\`\nollama serve\nollama pull ${ollama.MODEL}\n\`\`\`\n\n(Details: ${err.message})`
          : `The local AI model returned an error: ${err.message}`;
      break;
    }

    const message = response.message || {};
    const nativeToolCalls = message.tool_calls || [];

    if (nativeToolCalls.length > 0) {
      messages.push({ role: 'assistant', content: message.content || '', tool_calls: nativeToolCalls });

      for (const call of nativeToolCalls) {
        const name = call.function?.name;
        let args = call.function?.arguments;
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch { args = {}; }
        }
        const result = await tools.execute(name, args || {});
        toolTrace.push({ name, args, result });
        messages.push({ role: 'tool', content: JSON.stringify(result) });
      }
      continue;
    }

    const fallbackCall = tryParseFallbackToolCall(message.content);
    if (fallbackCall) {
      const result = await tools.execute(fallbackCall.name, fallbackCall.arguments || {});
      toolTrace.push({ name: fallbackCall.name, args: fallbackCall.arguments, result });
      messages.push({ role: 'assistant', content: message.content });
      messages.push({
        role: 'user',
        content: `Tool result for ${fallbackCall.name}: ${JSON.stringify(result)}\n\nNow continue: call another tool the same way if you still need data, otherwise give your final answer as plain prose (not JSON).`
      });
      continue;
    }

    finalReply = message.content || '(no response)';
    break;
  }

  if (finalReply === null) {
    finalReply = "I gathered some data but couldn't finish reasoning about it in time — could you narrow down the question a bit?";
  }

  const updatedHistory = [
    ...history,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: finalReply }
  ];

  return { reply: finalReply, history: updatedHistory, toolTrace };
}

module.exports = { handleMessage };
