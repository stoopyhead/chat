/**
 * knowledge/incidents.js — fabricated past-incident history, with a simple
 * keyword-overlap similarity search. Stands in for a real incident database
 * (PagerDuty, Jira, an incidents.md log) that a production version would
 * query and rank properly.
 */

const INCIDENTS = [
  {
    id: 'INC-2231',
    title: 'payments-api CrashLoopBackOff after config change reduced downstream timeout',
    date: '2026-07-11',
    tags: ['crashloopbackoff', 'payments-api', 'timeout', 'config'],
    rootCause: 'DOWNSTREAM_TIMEOUT_MS was lowered below the p99 latency of the ledger service, causing every request to fail and the readiness probe to flap.',
    resolution: 'Reverted the config change; timeout restored to 5000ms; added an alert on downstream p99 latency approaching the configured timeout.'
  },
  {
    id: 'INC-2198',
    title: 'checkout-worker stuck in ImagePullBackOff after release candidate tag push',
    date: '2026-06-02',
    tags: ['imagepullbackoff', 'checkout-worker', 'registry', 'release candidate'],
    rootCause: 'Deploy stage ran before the registry finished replicating the newly pushed RC image tag across regions.',
    resolution: 'Added a 60s wait-and-verify step between push and deploy in the pipeline; no recurrence since.'
  },
  {
    id: 'INC-2140',
    title: 'payments-db-migrate job OOMKilled during large backfill',
    date: '2026-05-20',
    tags: ['oomkilled', 'migration', 'payments', 'batch'],
    rootCause: 'Migration batch size was increased for a one-off backfill without a corresponding memory limit increase.',
    resolution: 'Chunked the backfill into smaller batches; documented safe batch-size-to-memory ratio in the migration runbook.'
  },
  {
    id: 'INC-2077',
    title: 'observability namespace pods stuck Pending after quota reduction',
    date: '2026-04-15',
    tags: ['pending', 'failedscheduling', 'quota', 'observability'],
    rootCause: 'Platform team reduced the namespace memory ResourceQuota ahead of a node pool downsize, but existing pending workloads no longer fit.',
    resolution: 'Temporarily raised the quota until the new node pool was live, then re-applied the reduction.'
  }
];

function searchIncidents(query) {
  if (!query || !query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = INCIDENTS.map((inc) => {
    const haystack = `${inc.title} ${inc.tags.join(' ')} ${inc.rootCause}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (inc.tags.some((t) => t.includes(term))) score += 3;
      if (inc.title.toLowerCase().includes(term)) score += 2;
      if (haystack.includes(term)) score += 1;
    }
    return { incident: inc, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.incident);
}

/** Find incidents similar to a given pod's current failure signature. */
function findSimilarToPod(pod) {
  const query = [pod.status, pod.name, ...pod.name.split('-')].join(' ');
  return searchIncidents(query);
}

module.exports = { INCIDENTS, searchIncidents, findSimilarToPod };
