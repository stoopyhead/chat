/**
 * troubleshooting/capacityPlanner.js
 *
 * Capacity and scaling analysis: which nodes are hot, which pods can't
 * schedule as a result, and what to do about it.
 */

const capacity = require('../k8s/mockCapacity');
const k8s = require('../k8s/mockData');
const engine = require('./engine');

const HOT_THRESHOLD_PCT = 85;

async function planCapacity() {
  const nodes = await capacity.listNodeCapacity();
  const pods = await k8s.listPods();

  const hotNodes = nodes.filter(
    (n) => (n.cpu?.usedPct || 0) >= HOT_THRESHOLD_PCT || (n.memory?.usedPct || 0) >= HOT_THRESHOLD_PCT
  );

  const schedulingBlockedPods = pods.filter((p) => engine.classify(p) === 'pending');

  const recommendations = [];

  for (const node of hotNodes) {
    const memoryPct = node.memory?.usedPct || 0;
    const cpuPct = node.cpu?.usedPct || 0;
    const dimension = memoryPct >= cpuPct ? 'memory' : 'CPU';
    const pct = dimension === 'memory' ? memoryPct : cpuPct;

    recommendations.push(
      `${node.name} is at ${pct}% ${dimension} utilization. Consider rebalancing workloads or adding node capacity.`
    );
  }

  if (schedulingBlockedPods.length > 0) {
    recommendations.push(
      `${schedulingBlockedPods.length} pod(s) are Pending/unschedulable: ${schedulingBlockedPods.map((p) => p.name).join(', ')}`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('No nodes are near capacity right now.');
  }

  return { nodes, hotNodes, schedulingBlockedPods, recommendations };
}

module.exports = { planCapacity, HOT_THRESHOLD_PCT };
