/**
 * mockChanges.js — fabricated "what changed recently" timeline.
 * Stands in for a real change feed (deployment history, config map diffs,
 * Helm release history, Argo CD app history, etc).
 */

const CHANGES = [
  {
    id: 'chg-1092',
    type: 'Deployment',
    target: 'payments-api',
    namespace: 'payments',
    description: 'Rolled out image payments-api:1.8.3 (previous: 1.8.2)',
    author: 'r.iyer',
    at: '2026-08-24T05:50:10Z'
  },
  {
    id: 'chg-1091',
    type: 'ConfigMap',
    target: 'payments-api-config',
    namespace: 'payments',
    description: 'Reduced DOWNSTREAM_TIMEOUT_MS from 5000 to 1500',
    author: 'r.iyer',
    at: '2026-08-24T05:49:40Z'
  },
  {
    id: 'chg-1088',
    type: 'Deployment',
    target: 'checkout-worker',
    namespace: 'checkout',
    description: 'Rolled out image checkout-worker:2.4.0-rc1 (previous: 2.3.9)',
    author: 'm.torres',
    at: '2026-08-24T05:39:05Z'
  },
  {
    id: 'chg-1085',
    type: 'Job',
    target: 'payments-db-migrate-job',
    namespace: 'payments',
    description: 'Triggered scheduled migration job (batch size increased to 4.8M rows)',
    author: 'ci-bot',
    at: '2026-08-24T05:15:20Z'
  },
  {
    id: 'chg-1080',
    type: 'ResourceQuota',
    target: 'observability',
    namespace: 'observability',
    description: 'Namespace memory quota reduced from 16Gi to 8Gi ahead of node pool downsizing',
    author: 'platform-team',
    at: '2026-08-24T04:50:00Z'
  },
  {
    id: 'chg-1071',
    type: 'Deployment',
    target: 'checkout-api',
    namespace: 'checkout',
    description: 'Rolled out image checkout-api:3.2.1 (previous: 3.2.0)',
    author: 'm.torres',
    at: '2026-08-22T14:05:30Z'
  }
];

function listChanges() {
  return [...CHANGES].sort((a, b) => new Date(b.at) - new Date(a.at));
}

function findRelatedChanges(podOrTarget) {
  const base = podOrTarget.split('-').slice(0, 2).join('-');
  return CHANGES.filter((c) => podOrTarget.includes(c.target) || c.target === base || base.startsWith(c.target));
}

module.exports = { listChanges, findRelatedChanges };
