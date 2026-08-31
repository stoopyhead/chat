/**
 * mockAlerts.js — fabricated recent alerts, as if forwarded from
 * Prometheus/Alertmanager into a Teams channel. This demo only reads this
 * feed; it does not send anything to a real Teams channel.
 */

const ALERTS = [
  {
    id: 'alrt-3301',
    severity: 'Critical',
    title: 'CrashLoopBackOff: payments-api-7d8f9c6b4-x2m9k',
    namespace: 'payments',
    firedAt: '2026-08-24T05:58:30Z',
    status: 'Firing'
  },
  {
    id: 'alrt-3298',
    severity: 'Warning',
    title: 'ImagePullBackOff: checkout-worker-5b6c7d8f9-p7q2r',
    namespace: 'checkout',
    firedAt: '2026-08-24T05:41:15Z',
    status: 'Firing'
  },
  {
    id: 'alrt-3294',
    severity: 'Critical',
    title: 'OOMKilled: payments-db-migrate-job-4x9z2',
    namespace: 'payments',
    firedAt: '2026-08-24T05:10:05Z',
    status: 'Firing'
  },
  {
    id: 'alrt-3290',
    severity: 'Warning',
    title: 'FailedScheduling: payments-api-7d8f9c6b4-z8y7x',
    namespace: 'payments',
    firedAt: '2026-08-24T05:59:05Z',
    status: 'Firing'
  },
  {
    id: 'alrt-3271',
    severity: 'Info',
    title: 'Deployment succeeded: checkout-api 3.2.1',
    namespace: 'checkout',
    firedAt: '2026-08-22T14:05:35Z',
    status: 'Resolved'
  }
];

function listAlerts() {
  return [...ALERTS].sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt));
}

module.exports = { listAlerts };
