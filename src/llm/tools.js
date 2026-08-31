/**
 * llm/tools.js
 *
 * The "hands" the LLM is given. Each tool wraps existing DETECT/DIAGNOSE
 * logic (k8s/mockData, troubleshooting/engine+rca+capacityPlanner,
 * knowledge/sops+incidents, k8s/mockAlerts) and returns plain JSON — the
 * model decides when to call these and turns the result into a real answer,
 * instead of a fixed command router deciding everything up front.
 *
 * All tools are strictly read-only, matching the assistant's scope.
 */

const k8s = require('../k8s/mockData');
const engine = require('../troubleshooting/engine');
const { generateRCA } = require('../troubleshooting/rca');
const { planCapacity } = require('../troubleshooting/capacityPlanner');
const { searchSOPs } = require('../knowledge/sops');
const { searchIncidents, findSimilarToPod } = require('../knowledge/incidents');
const { listAlerts } = require('../k8s/mockAlerts');
const { analyzeWithK8sGPT } = require('./k8sgptAnalyzer');

function reasonForPod(pod) {
  const rule = engine.RULES[pod.status];
  if (rule) return rule.cause;
  if (pod.restartCount >= engine.RESTART_THRESHOLD) return `High restart count (${pod.restartCount})`;
  return 'n/a';
}

async function getClusterOverview() {
  const [nodes, namespaces, deployments, pods] = await Promise.all([
    k8s.listNodes(),
    k8s.listNamespaces(),
    k8s.listDeployments(),
    k8s.listPods()
  ]);

  const podSummary = { total: pods.length, healthy: 0, unhealthy: 0, pending: 0, restarting: 0 };
  const byNamespace = {};

  for (const pod of pods) {
    const cls = engine.classify(pod);
    podSummary[cls] = (podSummary[cls] || 0) + 1;
    if (!byNamespace[pod.namespace]) {
      byNamespace[pod.namespace] = { namespace: pod.namespace, total: 0, healthy: 0, unhealthy: 0, pending: 0, restarting: 0 };
    }
    byNamespace[pod.namespace].total++;
    byNamespace[pod.namespace][cls] = (byNamespace[pod.namespace][cls] || 0) + 1;
  }

  const unhealthyDeployments = deployments.filter((d) => d.availableReplicas < d.desiredReplicas);

  return {
    nodes,
    namespaces,
    workloads: { totalDeployments: deployments.length, unhealthyDeployments },
    pods: podSummary,
    podsByNamespace: Object.values(byNamespace)
  };
}

async function listUnhealthyWorkloads() {
  const [pods, deployments] = await Promise.all([k8s.listPods(), k8s.listDeployments()]);

  const unhealthyPods = pods
    .filter((p) => engine.classify(p) !== 'healthy')
    .map((p) => ({
      resourceType: 'Pod',
      name: p.name,
      namespace: p.namespace,
      status: p.status,
      restartCount: p.restartCount,
      node: p.node,
      likelyCause: reasonForPod(p)
    }));

  const unhealthyDeployments = deployments
    .filter((d) => d.availableReplicas < d.desiredReplicas)
    .map((d) => ({
      resourceType: 'Deployment',
      name: d.name,
      namespace: d.namespace,
      status: `${d.availableReplicas}/${d.desiredReplicas} replicas available`,
      likelyCause: 'One or more backing pods are unhealthy — see the Pod entries for the same namespace/name prefix.'
    }));

  return { unhealthyPods, unhealthyDeployments };
}

async function getWorkloadDetails({ name }) {
  const pod = await k8s.getPod(name);
  if (!pod) return { found: false, message: `No pod found named "${name}".` };
  const findings = engine.diagnosePod(pod);
  return { found: true, pod, diagnosis: findings || [] };
}

function getLogs({ name, tailLines }) {
  const lines = k8s.getLogs(name);
  if (lines === null) return { found: false, message: `No pod found named "${name}".` };
  const limit = Number.isFinite(tailLines) ? tailLines : 50;
  return { found: true, name, lines: lines.slice(-limit) };
}

function getEvents({ name }) {
  const events = k8s.getEvents(name);
  if (events === null) return { found: false, message: `No pod found named "${name}".` };
  return { found: true, name, events };
}

function getAlerts() {
  const alerts = listAlerts();
  return { alerts, firingCount: alerts.filter((a) => a.status === 'Firing').length };
}

async function runRCA({ name }) {
  const report = await generateRCA(name);
  if (!report) return { found: false, message: `No pod found named "${name}".` };
  return { found: true, report };
}

function runSearchSOPs({ query }) {
  const results = searchSOPs(query || '');
  return { query, results };
}

async function runSearchIncidents({ query }) {
  if (!query) return { query, results: [] };
  const pod = await k8s.getPod(query);
  const results = pod ? findSimilarToPod(pod) : searchIncidents(query);
  return { query, results };
}

async function runPlanCapacity() {
  return planCapacity();
}

async function runAIDiagnose({ name }) {
  return analyzeWithK8sGPT(name);
}

/**
 * Ollama-native tool schema (JSON-schema style). Passed through to models
 * that support function calling; ignored harmlessly by ones that don't
 * (agent.js has a prompt-based fallback either way).
 */
const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'get_cluster_overview',
      description: 'Get overall cluster health: nodes, namespaces, workload/deployment counts, and pod health broken down by namespace. Use for "how is the cluster/environment doing" style questions.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_unhealthy_workloads',
      description: 'List all currently unhealthy pods and deployments across the cluster, with likely cause for each. Use when asked to find/identify unhealthy pods, deployments, or workloads.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_workload_details',
      description: 'Get full details and diagnosis for one specific pod by name (status, container info, restart count, findings).',
      parameters: { type: 'object', properties: { name: { type: 'string', description: 'Exact pod name' } }, required: ['name'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_logs',
      description: 'Get recent container log lines for a specific pod by name.',
      parameters: { type: 'object', properties: { name: { type: 'string' }, tailLines: { type: 'number', description: 'How many recent lines to return, default 50' } }, required: ['name'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_events',
      description: 'Get Kubernetes events for a specific pod by name.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_alerts',
      description: 'Get the current alert feed (firing and recently resolved alerts) from the monitoring system.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_rca',
      description: 'Generate a Root Cause Analysis for a specific pod by correlating its status, logs, events, and recent changes. Use for "investigate", "what happened", "root cause", "why is X failing" questions.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ai_diagnose',
      description: 'Run an AI-backed diagnosis (k8sgpt-style) on a specific unhealthy resource, producing a plain-English explanation and a remediation plan. Prefer this (or run_rca) when the user wants a deeper AI explanation of a failure, not just raw status.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_sops',
      description: 'Search the SOP/runbook knowledge base by keyword (e.g. "crashloopbackoff", "oom", "pending").',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_incidents',
      description: 'Find similar historical incidents, either by keyword or by passing a current pod name to match its failure signature.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Keywords, or a pod name' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'plan_capacity',
      description: 'Run a capacity and scaling analysis: which nodes are near capacity, which pods are blocked from scheduling as a result, and recommendations.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
];

const EXECUTORS = {
  get_cluster_overview: getClusterOverview,
  list_unhealthy_workloads: listUnhealthyWorkloads,
  get_workload_details: getWorkloadDetails,
  get_logs: getLogs,
  get_events: getEvents,
  get_alerts: getAlerts,
  run_rca: runRCA,
  ai_diagnose: runAIDiagnose,
  search_sops: runSearchSOPs,
  search_incidents: runSearchIncidents,
  plan_capacity: runPlanCapacity
};

async function execute(name, args) {
  const fn = EXECUTORS[name];
  if (!fn) return { error: `Unknown tool "${name}".` };
  try {
    return await fn(args || {});
  } catch (err) {
    return { error: `Tool "${name}" failed: ${err.message}` };
  }
}

module.exports = { TOOL_SCHEMAS, execute };
