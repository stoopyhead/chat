const mockData = require('./mockData');

/**
 * Node-level capacity view, derived from the same mock node data used
 * elsewhere so numbers stay consistent across health/capacity/RCA.
 */
async function listNodeCapacity() {
  const nodes = await mockData.listNodes();

  return nodes.map((n) => ({
    name: n.name,
    role: n.role,
    status: n.status,
    cpu: { capacity: n.cpu.capacityCores, usedPct: n.cpu.usedPct },
    memory: { capacity: n.memory.capacityGi, usedPct: n.memory.usedPct },
    pods: { capacity: n.pods.capacity, usedPct: n.pods.usedPct }
  }));
}

module.exports = { listNodeCapacity };
