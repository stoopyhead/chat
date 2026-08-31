/**
 * k8s/mockData.js
 *
 * Fully self-contained mock Kubernetes state: nodes, namespaces, deployments,
 * pods, their events and logs. Nothing in this file talks to a real cluster
 * or reads a kubeconfig — it's the "DETECT" layer for the local demo.
 *
 * To point this at a real cluster later, keep the exact function signatures
 * below and swap the bodies for @kubernetes/client-node calls (list pods,
 * read logs, list events, etc.).
 */

const NODES = [
  { name: 'node-a', role: 'worker', status: 'Ready', cpu: { capacityCores: 8, usedPct: 74 }, memory: { capacityGi: 32, usedPct: 92 }, pods: { capacity: 40, usedPct: 68 } },
  { name: 'node-b', role: 'worker', status: 'Ready', cpu: { capacityCores: 8, usedPct: 51 }, memory: { capacityGi: 32, usedPct: 58 }, pods: { capacity: 40, usedPct: 45 } },
  { name: 'node-c', role: 'control-plane', status: 'Ready', cpu: { capacityCores: 4, usedPct: 33 }, memory: { capacityGi: 16, usedPct: 40 }, pods: { capacity: 20, usedPct: 30 } }
];

const NAMESPACES = ['payments', 'checkout', 'observability', 'kube-system'];

const DEPLOYMENTS = [
  { name: 'payments-api', namespace: 'payments', desiredReplicas: 3, availableReplicas: 1, image: 'payments-api:1.8.3' },
  { name: 'checkout-worker', namespace: 'checkout', desiredReplicas: 2, availableReplicas: 1, image: 'checkout-worker:2.4.0-rc1' },
  { name: 'checkout-api', namespace: 'checkout', desiredReplicas: 2, availableReplicas: 2, image: 'checkout-api:3.2.1' },
  { name: 'grafana', namespace: 'observability', desiredReplicas: 1, availableReplicas: 1, image: 'grafana:10.4.0' },
  { name: 'prometheus', namespace: 'observability', desiredReplicas: 1, availableReplicas: 1, image: 'prometheus:2.53.0' },
  { name: 'coredns', namespace: 'kube-system', desiredReplicas: 2, availableReplicas: 2, image: 'coredns:1.11.1' }
];

const PODS = [
  {
    name: 'payments-api-7d8f9c6b4-x2m9k',
    namespace: 'payments',
    node: 'node-b',
    status: 'CrashLoopBackOff',
    restartCount: 14,
    podIP: '10.0.1.15',
    startTime: '2026-08-24T05:50:20Z',
    containers: [{ name: 'payments-api', image: 'payments-api:1.8.3', state: 'Waiting', reason: 'CrashLoopBackOff', lastExitCode: 1, lastTerminatedReason: 'Error' }]
  },
  {
    name: 'payments-api-7d8f9c6b4-z8y7x',
    namespace: 'payments',
    node: null,
    status: 'FailedScheduling',
    restartCount: 0,
    podIP: null,
    startTime: null,
    containers: [{ name: 'payments-api', image: 'payments-api:1.8.3', state: 'Waiting', reason: 'FailedScheduling', lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'payments-api-7d8f9c6b4-h3k1l',
    namespace: 'payments',
    node: 'node-b',
    status: 'Running',
    restartCount: 0,
    podIP: '10.0.1.22',
    startTime: '2026-08-20T09:00:00Z',
    containers: [{ name: 'payments-api', image: 'payments-api:1.8.2', state: 'Running', reason: null, lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'payments-db-migrate-job-4x9z2',
    namespace: 'payments',
    node: 'node-a',
    status: 'OOMKilled',
    restartCount: 0,
    podIP: '10.0.1.40',
    startTime: '2026-08-24T05:15:25Z',
    containers: [{ name: 'migrate', image: 'payments-db-migrate:1.2.0', state: 'Terminated', reason: 'OOMKilled', lastExitCode: 137, lastTerminatedReason: 'OOMKilled' }]
  },
  {
    name: 'checkout-worker-5b6c7d8f9-p7q2r',
    namespace: 'checkout',
    node: 'node-a',
    status: 'ImagePullBackOff',
    restartCount: 0,
    podIP: null,
    startTime: null,
    containers: [{ name: 'checkout-worker', image: 'checkout-worker:2.4.0-rc1', state: 'Waiting', reason: 'ImagePullBackOff', lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'checkout-worker-5b6c7d8f9-a1b2c',
    namespace: 'checkout',
    node: 'node-b',
    status: 'Running',
    restartCount: 0,
    podIP: '10.0.2.11',
    startTime: '2026-08-19T11:20:00Z',
    containers: [{ name: 'checkout-worker', image: 'checkout-worker:2.3.9', state: 'Running', reason: null, lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'checkout-api-6c7d8e9f0-m3n4o',
    namespace: 'checkout',
    node: 'node-b',
    status: 'Running',
    restartCount: 0,
    podIP: '10.0.2.30',
    startTime: '2026-08-22T14:06:00Z',
    containers: [{ name: 'checkout-api', image: 'checkout-api:3.2.1', state: 'Running', reason: null, lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'grafana-7f6e5d4c3-t1u2v',
    namespace: 'observability',
    node: 'node-c',
    status: 'Running',
    restartCount: 0,
    podIP: '10.0.3.10',
    startTime: '2026-08-01T00:00:00Z',
    containers: [{ name: 'grafana', image: 'grafana:10.4.0', state: 'Running', reason: null, lastExitCode: null, lastTerminatedReason: null }]
  },
  {
    name: 'prometheus-6d7e8f9a0-q5r6s',
    namespace: 'observability',
    node: 'node-c',
    status: 'Running',
    restartCount: 6,
    podIP: '10.0.3.15',
    startTime: '2026-08-18T00:00:00Z',
    containers: [{ name: 'prometheus', image: 'prometheus:2.53.0', state: 'Running', reason: null, lastExitCode: 1, lastTerminatedReason: 'Error' }]
  },
  {
    name: 'coredns-5d6f7g8h9-c1d2e',
    namespace: 'kube-system',
    node: 'node-c',
    status: 'Running',
    restartCount: 0,
    podIP: '10.0.0.5',
    startTime: '2026-08-01T00:00:00Z',
    containers: [{ name: 'coredns', image: 'coredns:1.11.1', state: 'Running', reason: null, lastExitCode: null, lastTerminatedReason: null }]
  }
];

const EVENTS = {
  'payments-api-7d8f9c6b4-x2m9k': [
    { type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container', count: 12, lastSeen: '2026-08-24T05:58:10Z' },
    { type: 'Warning', reason: 'Unhealthy', message: 'Readiness probe failed: HTTP probe failed with statuscode: 503', count: 9, lastSeen: '2026-08-24T05:57:40Z' }
  ],
  'payments-api-7d8f9c6b4-z8y7x': [
    { type: 'Warning', reason: 'FailedScheduling', message: '0/3 nodes are available: 1 node(s) had insufficient memory, 2 node(s) had taints the pod did not tolerate.', count: 5, lastSeen: '2026-08-24T05:59:05Z' }
  ],
  'payments-db-migrate-job-4x9z2': [
    { type: 'Warning', reason: 'OOMKilling', message: 'Memory cgroup out of memory: Killed process (migrate) total-vm:2100000kB', count: 1, lastSeen: '2026-08-24T05:10:00Z' }
  ],
  'checkout-worker-5b6c7d8f9-p7q2r': [
    { type: 'Warning', reason: 'Failed', message: 'Failed to pull image "checkout-worker:2.4.0-rc1": rpc error: code = NotFound', count: 8, lastSeen: '2026-08-24T05:41:00Z' },
    { type: 'Warning', reason: 'BackOff', message: 'Back-off pulling image "checkout-worker:2.4.0-rc1"', count: 8, lastSeen: '2026-08-24T05:41:10Z' }
  ],
  'prometheus-6d7e8f9a0-q5r6s': [
    { type: 'Warning', reason: 'Unhealthy', message: 'Liveness probe failed: connection refused', count: 3, lastSeen: '2026-08-23T22:00:00Z' }
  ]
};

const LOGS = {
  'payments-api-7d8f9c6b4-x2m9k': [
    '2026-08-24T05:58:00Z INFO  starting payments-api v1.8.3',
    '2026-08-24T05:58:01Z INFO  connecting to ledger-service at ledger.payments.svc:8443',
    '2026-08-24T05:58:02Z ERROR request to ledger-service timed out after 1500ms',
    '2026-08-24T05:58:02Z FATAL unhandled exception: LedgerTimeoutError, exiting',
    '2026-08-24T05:58:02Z INFO  process exiting with code 1'
  ],
  'payments-db-migrate-job-4x9z2': [
    '2026-08-24T05:10:00Z INFO  starting migration batch (rows=4800000)',
    '2026-08-24T05:10:03Z WARN  memory usage climbing: 1.8Gi / 2Gi limit',
    '2026-08-24T05:10:04Z ERROR out of memory while buffering batch rows'
  ],
  'checkout-worker-5b6c7d8f9-p7q2r': [],
  'prometheus-6d7e8f9a0-q5r6s': [
    '2026-08-23T22:00:00Z WARN  scrape target unreachable: connection refused'
  ]
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

async function listNodes() {
  return clone(NODES);
}

async function listNamespaces() {
  return clone(NAMESPACES);
}

async function listDeployments() {
  return clone(DEPLOYMENTS);
}

async function listPods() {
  return clone(PODS);
}

async function getPod(podName) {
  if (!podName) return null;
  const pod = PODS.find((p) => p.name.toLowerCase() === podName.toLowerCase());
  return pod ? clone(pod) : null;
}

function getLogs(podName) {
  const pod = PODS.find((p) => p.name.toLowerCase() === (podName || '').toLowerCase());
  if (!pod) return null;
  return clone(LOGS[pod.name] || []);
}

function getEvents(podName) {
  const pod = PODS.find((p) => p.name.toLowerCase() === (podName || '').toLowerCase());
  if (!pod) return null;
  return clone(EVENTS[pod.name] || []);
}

module.exports = {
  listNodes,
  listNamespaces,
  listDeployments,
  listPods,
  getPod,
  getLogs,
  getEvents
};
