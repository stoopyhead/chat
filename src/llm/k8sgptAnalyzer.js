/**
 * llm/k8sgptAnalyzer.js
 *
 * Plays the role k8sgpt / kagent play in a real stack: take an unhealthy
 * resource's raw signals (status, events, logs) and turn them into a plain-
 * English "what's wrong and how do I fix it" explanation, rather than just
 * surfacing the raw status string.
 *
 * Two modes:
 *   1. Real k8sgpt, if the `k8sgpt` CLI is installed and on PATH and a real
 *      kubeconfig/cluster is configured. We shell out to
 *      `k8sgpt analyze --explain --output json --filter <name>` and use its
 *      output directly. This is best-effort and safe to skip — see the
 *      `k8sgpt.enable` guard below.
 *   2. Internal fallback (used in this demo, since there's no real cluster):
 *      reuse the RCA correlation engine's evidence (status + logs + events +
 *      recent changes) and shape it into the same kind of structured
 *      explain/remediate output k8sgpt would produce. This is what actually
 *      runs by default here.
 *
 * Either way, the calling agent (Ollama/Llama 3) still writes the final
 * natural-language answer — this module's job is just to hand it solid,
 * pre-correlated evidence instead of a raw status enum.
 */

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const { generateRCA } = require('../troubleshooting/rca');

const K8SGPT_ENABLED = process.env.K8SGPT_ENABLE === 'true';
const K8SGPT_TIMEOUT_MS = 5000;

async function tryRealK8sGPT(resourceName) {
  if (!K8SGPT_ENABLED) return null;
  try {
    const { stdout } = await execFileAsync(
      'k8sgpt',
      ['analyze', '--explain', '--output', 'json', '--filter', resourceName],
      { timeout: K8SGPT_TIMEOUT_MS }
    );
    const parsed = JSON.parse(stdout);
    return { source: 'k8sgpt-cli', raw: parsed };
  } catch {
    // Not installed, no cluster configured, or it errored — fall back silently.
    return null;
  }
}

async function internalAnalysis(resourceName) {
  const rca = await generateRCA(resourceName);
  if (!rca) {
    return { source: 'internal', found: false, message: `No resource found named "${resourceName}".` };
  }

  const primary = rca.statusFindings[0];

  return {
    source: 'internal',
    found: true,
    resourceName,
    namespace: rca.pod.namespace,
    status: rca.pod.status,
    confidence: rca.confidence,
    explanation: rca.summary,
    evidence: {
      statusFindings: rca.statusFindings.map((f) => ({ trigger: f.trigger, cause: f.cause })),
      logHighlights: rca.logHits.map((h) => h.line),
      events: rca.events.map((e) => `[${e.type}] ${e.reason}: ${e.message}`),
      recentChanges: rca.relatedChanges.map((c) => `${c.description} (${c.author}, ${c.at})`)
    },
    remediation: primary ? primary.steps : ['Gather more logs/events — current evidence is inconclusive.']
  };
}

/**
 * Analyze one resource and return a structured, k8sgpt-style diagnosis.
 * Tries the real k8sgpt CLI first (if enabled and available), otherwise
 * uses the internal RCA-based correlation engine.
 */
async function analyzeWithK8sGPT(resourceName) {
  if (!resourceName) {
    return { source: 'internal', found: false, message: 'A resource name is required.' };
  }

  const real = await tryRealK8sGPT(resourceName);
  if (real) return real;

  return internalAnalysis(resourceName);
}

module.exports = { analyzeWithK8sGPT };
