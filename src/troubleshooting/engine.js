/**
 * troubleshooting/engine.js
 *
 * Pure diagnostic logic: given a pod's status/state, returns a likely cause,
 * a plain-English explanation, and recommended (read-only) next steps.
 *
 * This module never talks to the cluster and never issues commands — it only
 * reasons over data it's handed. That keeps DETECT (k8s/) and DIAGNOSE+EXPLAIN
 * (this file) cleanly separated, per the DETECT → DIAGNOSE → EXPLAIN →
 * RECOMMEND workflow.
 */

const RESTART_THRESHOLD = 5;

const RULES = {
  CrashLoopBackOff: {
    cause: 'The container is starting and then exiting repeatedly, so Kubernetes is backing off before retrying.',
    explanation: 'This usually means the application crashes shortly after startup — an unhandled exception, a failed dependency check, a bad config value, or a missing environment variable.',
    steps: [
      'Check recent container logs for a stack trace or fatal error right before exit',
      'Check events for repeated "BackOff" or "Unhealthy" entries',
      'Verify environment variables, secrets, and config maps the container expects',
      'Confirm any dependency (DB, downstream API) the container calls on startup is reachable'
    ]
  },
  ImagePullBackOff: {
    cause: 'Kubernetes cannot pull the container image, so it is backing off before retrying the pull.',
    explanation: 'Typically caused by a wrong image tag, a private registry needing credentials, or the image simply not existing at that path/tag.',
    steps: [
      'Confirm the image name and tag are correct and were actually pushed to the registry',
      'Check for an imagePullSecret if the registry is private',
      'Check node-to-registry network connectivity',
      'Look at the pod events for the exact pull error message'
    ]
  },
  ErrImagePull: {
    cause: 'A single failed attempt to pull the container image (precursor to ImagePullBackOff).',
    explanation: 'Same root causes as ImagePullBackOff — bad tag, missing auth, or registry unavailable — just caught before the backoff loop starts.',
    steps: [
      'Check the exact error in pod events ("Failed to pull image...")',
      'Verify the image reference and registry credentials',
      'Try pulling the image manually from a machine with the same network access'
    ]
  },
  OOMKilled: {
    cause: 'The container exceeded its memory limit and the kernel OOM killer terminated it.',
    explanation: 'The process used more memory than the container\'s configured limit allowed, so Kubernetes killed it (exit code 137) to protect the node.',
    steps: [
      'Check the memory limit set on the container vs. actual usage patterns',
      'Look for a memory leak or an unusually large workload/request that spiked usage',
      'Consider raising the memory limit if the workload legitimately needs more',
      'Check events for repeated OOMKilling entries to see if this is a pattern'
    ]
  },
  FailedScheduling: {
    cause: 'The scheduler could not find a node that satisfies the pod\'s requirements.',
    explanation: 'Common causes: insufficient CPU/memory on all nodes, a taint the pod doesn\'t tolerate, a nodeSelector/affinity rule that no node matches, or no nodes available at all.',
    steps: [
      'Read the FailedScheduling event message closely — it names the exact reason',
      'Check node resource availability (CPU/memory requests vs. capacity)',
      'Check for taints on nodes and tolerations on the pod spec',
      'Check nodeSelector / affinity rules against actual node labels'
    ]
  },
  Pending: {
    cause: 'The pod has been accepted but is not yet scheduled or its containers have not started.',
    explanation: 'Pending can mean the scheduler hasn\'t placed it yet (see FailedScheduling), or a required resource like a PersistentVolumeClaim isn\'t bound yet.',
    steps: [
      'Check pod events for a scheduling or volume-binding reason',
      'Check whether any PVCs referenced by the pod are Bound',
      'Check node capacity and availability'
    ]
  },
  ContainerCreating: {
    cause: 'The pod is scheduled and Kubernetes is setting up the container (image pull, volume mount, network setup).',
    explanation: 'Usually transient. If it stays in this state for a long time, it\'s often a slow image pull, a volume that can\'t mount, or a CNI/network plugin issue.',
    steps: [
      'Check events for volume mount errors or slow image pulls',
      'Confirm the image size isn\'t unusually large for the node\'s network speed',
      'Check node CNI/network plugin health if this affects many pods at once'
    ]
  }
};

function highRestartNote(restartCount) {
  return {
    cause: `Restart count (${restartCount}) is above the healthy threshold (${RESTART_THRESHOLD}).`,
    explanation: 'A high restart count usually points to an underlying crash loop, failing readiness/liveness probe, or resource pressure — check the pod\'s primary status alongside this.',
    steps: [
      'Correlate with the pod\'s current status/reason for the root cause',
      'Review logs around each restart, not just the latest one',
      'Check readiness/liveness probe configuration for over-aggressive thresholds'
    ]
  };
}

/**
 * Diagnose a single pod object (shape from k8s/mockData.js or a real client).
 * Returns null if the pod looks healthy and has no notable restarts.
 */
function diagnosePod(pod) {
  const findings = [];

  const rule = RULES[pod.status];
  if (rule) {
    findings.push({ trigger: pod.status, ...rule });
  }

  if (pod.restartCount >= RESTART_THRESHOLD) {
    findings.push({ trigger: 'HighRestartCount', ...highRestartNote(pod.restartCount) });
  }

  // Terminated-with-OOM at the container level, even if pod status itself
  // reads differently (e.g. a completed Job pod).
  const container = pod.containers && pod.containers[0];
  if (container && container.lastTerminatedReason === 'OOMKilled' && pod.status !== 'OOMKilled') {
    findings.push({ trigger: 'OOMKilled', ...RULES.OOMKilled });
  }

  if (findings.length === 0) return null;
  return findings;
}

function isHealthy(pod) {
  return pod.status === 'Running' && pod.restartCount < RESTART_THRESHOLD;
}

function classify(pod) {
  if (pod.status === 'Pending' || pod.status === 'ContainerCreating' || pod.status === 'FailedScheduling') {
    return 'pending';
  }
  if (pod.restartCount > 0 && pod.status === 'Running') {
    return 'restarting';
  }
  if (isHealthy(pod)) {
    return 'healthy';
  }
  return 'unhealthy';
}

module.exports = {
  RESTART_THRESHOLD,
  RULES,
  diagnosePod,
  isHealthy,
  classify
};
