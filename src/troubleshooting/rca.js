/**
 * troubleshooting/rca.js
 *
 * Generates a Root Cause Analysis report for a pod by correlating signals
 * together, rather than just reading pod status in isolation:
 *
 *   1. Pod status/state       (k8s/mockData.getPod)
 *   2. Container logs         (k8s/mockData.getLogs)   -> log pattern match
 *   3. Kubernetes events      (k8s/mockData.getEvents) -> confirms the pattern
 *   4. Recent changes         (k8s/mockChanges)        -> timing correlation
 *
 * engine.js answers "what kind of failure is this and what's the generic
 * playbook"; this file builds a specific, evidence-backed narrative for one
 * resource, with a confidence level based on how much evidence agrees.
 */

const k8s = require('../k8s/mockData');
const changes = require('../k8s/mockChanges');
const engine = require('./engine');

// Log-line pattern -> likely-cause fragment, layered on top of the
// status-based rules in engine.js so the RCA can cite *which log line*
// pointed at the cause, not just the pod's status field.
const LOG_PATTERNS = [
  { match: /out of memory|oom/i, cause: 'memory exhaustion inside the container process' },
  { match: /timed out|timeout/i, cause: 'a downstream dependency call timing out' },
  { match: /connection refused|econnrefused/i, cause: 'a downstream dependency being unreachable' },
  { match: /unhandled exception|panic|fatal/i, cause: 'an unhandled application-level error' },
  { match: /permission denied|unauthorized|403/i, cause: 'a permissions or credentials problem' }
];

function scanLogsForCause(lines) {
  const hits = [];
  for (const line of lines) {
    for (const pattern of LOG_PATTERNS) {
      if (pattern.match.test(line)) {
        hits.push({ line, cause: pattern.cause });
      }
    }
  }
  return hits;
}

/**
 * Build a full RCA report for a pod name.
 * Returns null if the pod doesn't exist.
 */
async function generateRCA(podName) {
  const pod = await k8s.getPod(podName);
  if (!pod) return null;

  const logs = k8s.getLogs(podName) || [];
  const events = k8s.getEvents(podName) || [];
  const statusFindings = engine.diagnosePod(pod) || [];
  const logHits = scanLogsForCause(logs);
  const relatedChanges = changes.findRelatedChanges(podName);

  // Confidence: starts at "Low", rises as independent signal sources agree.
  let signals = 0;
  if (statusFindings.length > 0) signals++;
  if (logHits.length > 0) signals++;
  if (events.length > 0) signals++;
  if (relatedChanges.length > 0) signals++;

  let confidence = 'Low';
  if (signals >= 3) confidence = 'High';
  else if (signals === 2) confidence = 'Medium';

  const primary = statusFindings[0];
  const summaryParts = [];
  if (primary) {
    summaryParts.push(primary.cause);
  }
  if (logHits.length > 0) {
    const uniqueCauses = [...new Set(logHits.map((h) => h.cause))];
    summaryParts.push(`Logs point specifically to ${uniqueCauses.join(' and ')}.`);
  }
  if (relatedChanges.length > 0) {
    const mostRecent = relatedChanges[0];
    summaryParts.push(
      `This closely follows a recent change: "${mostRecent.description}" by ${mostRecent.author} at ${mostRecent.at}.`
    );
  }

  const timeline = buildTimeline(events, relatedChanges);

  return {
    pod,
    confidence,
    signals,
    summary: summaryParts.join(' ') || 'Not enough evidence to determine a specific cause beyond the pod status.',
    statusFindings,
    logHits,
    events,
    relatedChanges,
    timeline,
    recommendedSteps: primary ? primary.steps : ['Run logs and events on this pod for more detail.']
  };
}

function buildTimeline(events, relatedChanges) {
  const items = [];
  for (const c of relatedChanges) {
    items.push({ at: c.at, kind: 'Change', detail: `${c.type}: ${c.description} (${c.author})` });
  }
  for (const e of events) {
    items.push({ at: e.lastSeen, kind: 'Event', detail: `[${e.type}] ${e.reason}: ${e.message}` });
  }
  return items.sort((a, b) => new Date(a.at) - new Date(b.at));
}

module.exports = { generateRCA };
