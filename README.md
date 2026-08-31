# OpsCopilot — AI Kubernetes Operations Assistant (local demo)

A local, credential-free demo of an AI assistant for **monitoring, troubleshooting,
diagnosing, and improving Kubernetes environments** using live operational data.

Unlike the earlier version of this project, the chatbot is no longer a fixed
command router. Every message is handled by **Llama 3, running locally via
Ollama**, which decides for itself whether it needs to look at the (mock)
cluster or can just answer directly — including general conversation and
general DevOps/Kubernetes/Docker knowledge questions.

## What it does

- Check cluster, node, namespace, and workload health
- Identify unhealthy pods and deployments
- Investigate incidents and outages
- Generate Root Cause Analysis (RCA)
- Analyze alerts, events, logs, and resource issues
- Perform capacity and scaling analysis
- Search SOPs and runbooks
- Find similar historical incidents
- Recommend remediation actions (read-only — it never modifies the cluster)

It is also just... a competent chatbot. Say "hi", ask "what is Grafana?", ask
about the difference between a Deployment and a StatefulSet — it answers
normally, the same way any general-purpose assistant would, instead of
replying "unrecognized command."

## Architecture

```
Browser UI  →  Express server  →  LLM agent (src/llm/agent.js)
                                        │
                                        ├─ Ollama (Llama 3) — the reasoning model
                                        │
                                        └─ Tools (src/llm/tools.js), read-only:
                                             ├─ k8s/mockData.js        (pods, nodes, namespaces, deployments, logs, events)
                                             ├─ k8s/mockAlerts.js      (alert feed)
                                             ├─ k8s/mockChanges.js     (recent change/deploy history, used by RCA)
                                             ├─ troubleshooting/engine.js         (status → cause/explanation/steps rules)
                                             ├─ troubleshooting/rca.js            (multi-signal RCA correlation)
                                             ├─ troubleshooting/capacityPlanner.js
                                             ├─ knowledge/sops.js                 (runbook search)
                                             ├─ knowledge/incidents.js            (historical incident search)
                                             └─ llm/k8sgptAnalyzer.js  (k8sgpt-style AI diagnosis — see below)
```

The model never fabricates cluster data: whenever a question needs current
state (pod status, logs, alerts, etc.), it calls a tool to fetch it, then
writes the answer from the real result. It supports both native Ollama
function-calling (for models like `llama3.1`/`llama3.2`) and a JSON-based
fallback protocol that works with plain `llama3`.

### Where k8sgpt / kagent fit in

`src/llm/k8sgptAnalyzer.js` plays the role k8sgpt/kagent play in a real
stack: turning a resource's raw signals (status, events, logs) into a plain-
English "what's wrong and how do I fix it" explanation.

- If you have the real [k8sgpt](https://k8sgpt.ai) CLI installed **and** a
  real cluster configured, set `K8SGPT_ENABLE=true` and it will shell out to
  `k8sgpt analyze --explain --output json` and use its output directly.
- Otherwise (the default, and what runs in this demo with no real cluster),
  it falls back to an internal correlation engine that reuses the RCA logic
  (status + logs + events + recent changes) to produce the same shape of
  explain/remediate output. The outer Llama 3 agent then narrates it.

## Setup

1. **Install Ollama** (runs Llama 3 locally, no API key, no cloud call):
   https://ollama.com

2. **Pull the model:**
   ```
   ollama pull llama3
   ```
   (Prefer better tool-calling? `ollama pull llama3.1` and set
   `OLLAMA_MODEL=llama3.1` — see below.)

3. **Make sure Ollama is running:**
   ```
   ollama serve
   ```
   (On macOS/Windows it usually runs automatically in the background after
   install — check by opening http://localhost:11434 in a browser.)

4. **Install this project's dependencies and run it:**
   ```
   npm install
   npm start
   ```

5. Open http://localhost:3978 in your browser.

The header pill shows whether Ollama is reachable. If it says "Ollama
unreachable", double check step 3.

## Environment variables (all optional)

| Variable         | Default                  | Purpose                                      |
|------------------|---------------------------|-----------------------------------------------|
| `OLLAMA_HOST`    | `http://localhost:11434` | Where Ollama's API is listening               |
| `OLLAMA_MODEL`   | `llama3`                  | Which pulled model to use                     |
| `K8SGPT_ENABLE`  | `false`                   | `true` to shell out to a real `k8sgpt` CLI    |
| `PORT`           | `3978`                    | Local web server port                         |

## Read-only, no credentials

- No kubeconfig, no cluster connection, no Teams tenant/App ID.
- `src/k8s/*.js` is entirely mock data — swap those modules for real
  `@kubernetes/client-node` calls (behind the same function signatures) to
  point this at a real cluster later. The LLM agent and tools layer don't
  need to change.
- The assistant only ever reads data and recommends actions — it never
  restarts, scales, deletes, or patches anything.

## Tests

```
npm test
```

Covers the diagnostic engine, RCA correlation, capacity planning, SOP/incident
search, and the tool layer the LLM agent calls into.
