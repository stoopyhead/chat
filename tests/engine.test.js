const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/troubleshooting/engine');
const k8s = require('../src/k8s/mockData');

test('classifies a running low-restart pod as healthy', () => {
  const pod = { status: 'Running', restartCount: 0 };
  assert.equal(engine.classify(pod), 'healthy');
});

test('classifies CrashLoopBackOff as unhealthy', () => {
  const pod = { status: 'CrashLoopBackOff', restartCount: 14 };
  assert.equal(engine.classify(pod), 'unhealthy');
});

test('diagnosePod returns findings for CrashLoopBackOff', async () => {
  const pod = await k8s.getPod('payments-api-7d8f9c6b4-x2m9k');
  const findings = engine.diagnosePod(pod);
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.trigger === 'CrashLoopBackOff'));
});

test('diagnosePod returns null for a healthy pod', async () => {
  const pod = await k8s.getPod('grafana-7f6e5d4c3-t1u2v');
  assert.equal(engine.diagnosePod(pod), null);
});

test('getPod returns null for an unknown pod', async () => {
  const pod = await k8s.getPod('nonexistent-pod');
  assert.equal(pod, null);
});

test('getLogs/getEvents return null for an unknown pod', () => {
  assert.equal(k8s.getLogs('nonexistent-pod'), null);
  assert.equal(k8s.getEvents('nonexistent-pod'), null);
});
