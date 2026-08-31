const chat = document.getElementById('chat');
const form = document.getElementById('composer');
const input = document.getElementById('input');
const modelPill = document.getElementById('modelPill');
const modelPillText = document.getElementById('modelPillText');

function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/* ---------------- tiny markdown-ish renderer ---------------- */
/* Supports: ```code fences```, **bold** (incl. as a standalone heading
   line), "- "/"* " bullet lists, "1. " numbered lists, and blank-line
   paragraph breaks. Enough for the assistant's structured answers without
   pulling in a markdown library. */

function renderInline(text) {
  let out = esc(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function renderMarkdown(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeBuf = [];
  let listBuf = [];
  let listType = null; // 'ul' | 'ol'

  function flushList() {
    if (listBuf.length) {
      html.push(`<${listType}>${listBuf.join('')}</${listType}>`);
      listBuf = [];
      listType = null;
    }
  }

  for (const raw of lines) {
    const line = raw;

    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre class="code-block">${esc(codeBuf.join('\n'))}</pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    const headingMatch = line.match(/^\s*\*\*(.+?)\*\*\s*:?\s*$/);

    if (bulletMatch) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuf.push(`<li>${renderInline(bulletMatch[1])}</li>`);
      continue;
    }
    if (numberedMatch) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuf.push(`<li>${renderInline(numberedMatch[1])}</li>`);
      continue;
    }
    flushList();

    if (headingMatch) {
      html.push(`<div class="answer-heading">${renderInline(headingMatch[1])}</div>`);
      continue;
    }
    if (line.trim() === '') {
      html.push('<div class="answer-spacer"></div>');
      continue;
    }
    html.push(`<p>${renderInline(line)}</p>`);
  }
  flushList();
  if (inCode && codeBuf.length) {
    html.push(`<pre class="code-block">${esc(codeBuf.join('\n'))}</pre>`);
  }

  return html.join('');
}

/* ---------------- message plumbing ---------------- */

function appendUserMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg--user';
  wrap.innerHTML = `
    <div class="msg__avatar msg__avatar--user">YOU</div>
    <div class="msg__col">
      <div class="msg__label">You</div>
      <div class="card card--user">${esc(text)}</div>
    </div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function appendBotMessage(replyMarkdown) {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg--bot';
  wrap.innerHTML = `
    <div class="msg__avatar msg__avatar--bot">OC</div>
    <div class="msg__col">
      <div class="msg__label">OpsCopilot</div>
      <div class="card">${renderMarkdown(replyMarkdown)}</div>
    </div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function appendTypingIndicator() {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg--bot';
  wrap.id = 'typingIndicator';
  wrap.innerHTML = `
    <div class="msg__avatar msg__avatar--bot">OC</div>
    <div class="msg__col">
      <div class="msg__label">OpsCopilot</div>
      <div class="card"><span class="typing"><span></span><span></span><span></span></span></div>
    </div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendCommand(text) {
  appendUserMessage(text);
  input.value = '';
  appendTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    removeTypingIndicator();
    if (!res.ok) {
      appendBotMessage(`⚠️ ${data.error || 'Something went wrong.'}`);
      return;
    }
    appendBotMessage(data.reply);
  } catch (err) {
    removeTypingIndicator();
    appendBotMessage(`⚠️ Failed to reach the local server: ${err.message}`);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  sendCommand(text);
});

document.querySelectorAll('.navcmd').forEach((btn) => {
  btn.addEventListener('click', () => sendCommand(btn.dataset.cmd));
});

/* ---------------- model status pill ---------------- */

async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const reachable = data?.ollama?.reachable;
    modelPill.classList.toggle('pill--live', !!reachable);
    modelPill.classList.toggle('pill--down', !reachable);
    modelPillText.textContent = reachable
      ? `Llama 3 online (${data.ollama.model})`
      : `Ollama unreachable at ${data?.ollama?.host || 'localhost:11434'}`;
  } catch {
    modelPill.classList.remove('pill--live');
    modelPill.classList.add('pill--down');
    modelPillText.textContent = 'Status unknown';
  }
}

refreshStatus();
setInterval(refreshStatus, 15000);
