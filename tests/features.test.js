const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRCA } = require('../src/troubleshooting/rca');
const { planCapacity } = require('../src/troubleshooting/capacityPlanner');
const { searchSOPs } = require('../src/knowledge/sops');
const { searchIncidents } = require('../src/knowledge/incidents');
const tools = require('../src/llm/tools');

test('generateRCA returns null for missing pod', async () => {
  assert.equal(await generateRCA('nonexistent-pod'), null);
});

test('generateRCA builds a report with confidence for a known failing pod', async () => {
  const report = await generateRCA('payments-api-7d8f9c6b4-x2m9k');
  assert.ok(report);
  assert.ok(['Low', 'Medium', 'High'].includes(report.confidence));
  assert.ok(report.summary.length > 0);
  assert.ok(Array.isArray(report.timeline));
});

test('planCapacity flags at least one hot node given mock data', async () => {
  const report = await planCapacity();
  assert.ok(report.hotNodes.length > 0);
  assert.ok(report.recommendations.length > 0);
});

test('searchSOPs finds the CrashLoopBackOff runbook by keyword', () => {
  const results = searchSOPs('crashloopbackoff');
  assert.ok(results.some((s) => s.id === 'sop-101'));
});

test('searchIncidents finds a relevant past incident by keyword', () => {
  const results = searchIncidents('oomkilled migration');
  assert.ok(results.length > 0);
});

test('tools.execute("list_unhealthy_workloads") reports unhealthy pods and deployments', async () => {
  const result = await tools.execute('list_unhealthy_workloads', {});
  assert.ok(result.unhealthyPods.length > 0);
  assert.ok(result.unhealthyDeployments.length > 0);
});

test('tools.execute("get_cluster_overview") reports node/namespace/pod data', async () => {
  const result = await tools.execute('get_cluster_overview', {});
  assert.ok(result.nodes.length > 0);
  assert.ok(result.namespaces.length > 0);
  assert.ok(result.pods.total > 0);
});

test('tools.execute("run_rca") returns a report for a known pod', async () => {
  const result = await tools.execute('run_rca', { name: 'payments-api-7d8f9c6b4-x2m9k' });
  assert.equal(result.found, true);
  assert.ok(result.report.confidence);
});

test('tools.execute("search_sops") returns matching SOPs', async () => {
  const result = await tools.execute('search_sops', { query: 'oom memory' });
  assert.ok(result.results.length > 0);
});

test('tools.execute("plan_capacity") returns structured capacity data', async () => {
  const result = await tools.execute('plan_capacity', {});
  assert.ok(Array.isArray(result.nodes));
  assert.ok(Array.isArray(result.recommendations));
});

test('tools.execute("ai_diagnose") returns an internal k8sgpt-style diagnosis without a real cluster', async () => {
  const result = await tools.execute('ai_diagnose', { name: 'checkout-worker-5b6c7d8f9-p7q2r' });
  assert.equal(result.source, 'internal');
  assert.equal(result.found, true);
  assert.ok(result.remediation.length > 0);
});
