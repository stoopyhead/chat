/**
 * knowledge/sops.js — a small fabricated library of Standard Operating
 * Procedures / runbooks, with simple keyword search. Stands in for a real
 * knowledge base (Confluence, Notion, a runbooks repo) that would be indexed
 * and searched properly (e.g. via embeddings) in a production version.
 */

const SOPS = [
  {
    id: 'sop-101',
    title: 'Runbook: CrashLoopBackOff triage',
    tags: ['crashloopbackoff', 'crash', 'restart', 'pod', 'liveness', 'readiness'],
    body: [
      '1. Run `logs <pod>` and look for the error immediately before the crash.',
      '2. Run `events <pod>` and check for repeated Unhealthy/BackOff events.',
      '3. Confirm the container\'s liveness/readiness probe thresholds are not too aggressive for cold start time.',
      '4. Check `changes` for a recent deploy or config change to the same workload.',
      '5. If a downstream dependency is timing out, verify its health independently before rolling back.',
      '6. If unresolved in 15 minutes, escalate to the owning team and consider rolling back the last deploy.'
    ].join('\n')
  },
  {
    id: 'sop-102',
    title: 'Runbook: ImagePullBackOff / ErrImagePull',
    tags: ['imagepullbackoff', 'errimagepull', 'image', 'registry', 'pull'],
    body: [
      '1. Confirm the exact image tag in the pod spec matches a tag that actually exists in the registry.',
      '2. If the tag was just pushed, allow a few minutes for registry replication before redeploying.',
      '3. Check for an imagePullSecrets entry if this is a private registry.',
      '4. Test registry connectivity from a node directly: `docker pull <image>` or `crictl pull <image>`.',
      '5. If the pipeline pushes and deploys in the same run, add a wait/verify step between push and deploy.'
    ].join('\n')
  },
  {
    id: 'sop-103',
    title: 'Runbook: OOMKilled workloads',
    tags: ['oomkilled', 'oom', 'memory', 'out of memory'],
    body: [
      '1. Check `details <pod>` for the configured memory limit vs. what the workload actually needs.',
      '2. Check whether the workload is processing an unusually large batch/request (see `changes`).',
      '3. Look for a memory leak: compare memory usage across recent runs if history is available.',
      '4. Short term: raise the memory limit modestly and monitor. Long term: profile the workload.',
      '5. For batch/migration jobs, consider chunking the workload instead of raising limits indefinitely.'
    ].join('\n')
  },
  {
    id: 'sop-104',
    title: 'Runbook: FailedScheduling / Pending pods',
    tags: ['failedscheduling', 'pending', 'scheduling', 'capacity', 'taint', 'affinity'],
    body: [
      '1. Read the FailedScheduling event message closely — it names the exact constraint that failed.',
      '2. Run `capacity` to check whether any node is near CPU/memory capacity.',
      '3. Check node taints against the pod\'s tolerations, and nodeSelector/affinity against node labels.',
      '4. If capacity is the cause, consider scaling the node pool or evicting lower-priority workloads.',
      '5. Check `changes` for a recent ResourceQuota reduction on the namespace.'
    ].join('\n')
  },
  {
    id: 'sop-105',
    title: 'Runbook: Rolling back a bad deployment',
    tags: ['rollback', 'revert', 'bad deploy', 'regression'],
    body: [
      '1. Confirm via an RCA that the most recent change correlates with the incident start time.',
      '2. Notify the owning team before rolling back — this is a write action, outside this read-only assistant\'s scope.',
      '3. After rollback, re-check pod and deployment health to confirm recovery.',
      '4. File a follow-up ticket referencing the change id for a proper post-mortem.'
    ].join('\n')
  }
];

function searchSOPs(query) {
  if (!query || !query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = SOPS.map((sop) => {
    const haystack = `${sop.title} ${sop.tags.join(' ')} ${sop.body}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (sop.tags.some((t) => t.includes(term))) score += 3;
      if (sop.title.toLowerCase().includes(term)) score += 2;
      if (haystack.includes(term)) score += 1;
    }
    return { sop, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.sop);
}

function getSOPsForTrigger(triggerName) {
  return searchSOPs(triggerName);
}

module.exports = { SOPS, searchSOPs, getSOPsForTrigger };
