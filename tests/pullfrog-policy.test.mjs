import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import yaml from 'js-yaml';

import { assertPullfrogWorkflowPolicy } from '../scripts/validate-pullfrog-policy.mjs';

const workflow = readFileSync(new URL('../.github/workflows/pullfrog.yml', import.meta.url), 'utf8');
const parse = () => yaml.load(workflow, { schema: yaml.JSON_SCHEMA });
const rejectMutation = (mutate) => {
  const config = parse();
  mutate(config);
  assert.throws(() => assertPullfrogWorkflowPolicy(yaml.dump(config)));
};

test('Pullfrog workflow satisfies the reviewed fail-closed PR-only policy', () => {
  assert.doesNotThrow(() => assertPullfrogWorkflowPolicy(workflow));
  assert.doesNotThrow(() => assertPullfrogWorkflowPolicy(yaml.dump(parse())));
});

test('rejects block, flow-map, quoted, and array-valued extra triggers', () => {
  const fixtures = [
    workflow.replace(/^  workflow_dispatch:/m, '  pull_request_target: {}\n  workflow_dispatch:'),
    workflow.replace(/^on:\n[\s\S]*?(?=^permissions:)/m,
      'on: { workflow_dispatch: {}, pull_request: {} }\n\n'),
    workflow.replace(/^  workflow_dispatch:/m, "  'pull_request': {}\n  workflow_dispatch:"),
    workflow.replace(/^on:\n[\s\S]*?(?=^permissions:)/m,
      'on: [workflow_dispatch, pull_request]\n\n'),
  ];
  for (const fixture of fixtures) assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
});

test('rejects nested triggers, injected jobs and unreviewed steps or inputs', () => {
  for (const mutate of [
    (c) => { c.jobs.pullfrog.env = { on: 'push' }; },
    (c) => { c.jobs.other = c.jobs.pullfrog; },
    (c) => { c.on.workflow_dispatch.inputs.command = { type: 'string' }; },
    (c) => { c.jobs.pullfrog.steps.push({ run: 'unreviewed-command' }); },
    (c) => { c.jobs.pullfrog.steps[2].with.inputs = { push: 'enabled' }; },
  ]) rejectMutation(mutate);
});

test('rejects provider secrets, broad credentials and runtime URL overrides', () => {
  for (const name of ['OPENAI_API_KEY', 'CODEX_AUTH_JSON', 'ANTHROPIC_API_KEY',
    'GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'API_URL', 'NODE_OPTIONS']) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].env[name] = '${{ secrets.SYNTHETIC }}'; });
  }
});

test('requires the exact trusted-repository and main-branch execution guard', () => {
  for (const value of [undefined, true, 'true', '${{ always() }}', '${{ false }}',
    "${{ github.ref == 'refs/heads/main' }}"]) {
    rejectMutation((c) => { c.jobs.pullfrog.if = value; });
  }
  rejectMutation((c) => { c.jobs.pullfrog['runs-on'] = ['self-hosted']; });
  rejectMutation((c) => { c.jobs.pullfrog['runs-on'] = 'ubuntu-latest'; });
});

test('requires only job-scoped OIDC and read-only source access', () => {
  rejectMutation((c) => { c.permissions['id-token'] = 'write'; });
  rejectMutation((c) => { c.permissions.contents = 'write'; });
  rejectMutation((c) => { c.permissions = ['contents', 'write']; });
  rejectMutation((c) => { delete c.jobs.pullfrog.permissions['id-token']; });
  rejectMutation((c) => { c.jobs.pullfrog.permissions.contents = 'write'; });
  rejectMutation((c) => { c.jobs.pullfrog.permissions['pull-requests'] = 'write'; });
});

test('requires the exact patched fork commit and fixed local runtime', () => {
  for (const uses of ['pullfrog/pullfrog@v0', 'pullfrog/pullfrog@ad4283a862b8377cb525a0f5bf30f17c023b18ea',
    'tachi-hideki-crelo/pullfrog-security@main',
    'tachi-hideki-crelo/pullfrog-security@0000000000000000000000000000000000000000']) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].uses = uses; });
  }
  for (const value of [undefined, '0', 1, '${{ secrets.PULLFROG_FORCE_LOCAL_CLI }}']) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].env.PULLFROG_FORCE_LOCAL_CLI = value; });
  }
});

test('rejects any code-push permission, including former restricted mode', () => {
  for (const push of ['restricted', 'enabled', 'unrestricted', undefined, ['disabled'], { value: 'disabled' }]) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.push = push; });
  }
});

test('requires restricted shell and rejects weaker, missing or malformed forms', () => {
  for (const shell of ['enabled', undefined, ['restricted'], { permission: 'restricted' }]) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.shell = shell; });
  }
});

test('requires bounded review duration and per-PR concurrency', () => {
  for (const minutes of [undefined, 360, '20']) {
    rejectMutation((c) => { c.jobs.pullfrog['timeout-minutes'] = minutes; });
  }
  for (const timeout of [undefined, '0', '1h', '${{ inputs.timeout }}']) {
    rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.timeout = timeout; });
  }
  rejectMutation((c) => { delete c.jobs.pullfrog.concurrency; });
  rejectMutation((c) => { c.jobs.pullfrog.concurrency.group = '${{ github.run_id }}'; });
  rejectMutation((c) => { c.jobs.pullfrog.concurrency['cancel-in-progress'] = true; });
});

test('requires dispatch validation before the credential-bearing action', () => {
  rejectMutation((c) => { c.jobs.pullfrog.steps.splice(1, 1); });
  rejectMutation((c) => { c.jobs.pullfrog.steps[1].run = 'echo pass'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[1].if = 'false'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[1].env.PULLFROG_DISPATCH = 'unvalidated'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[1].env.EXTRA = '${{ secrets.SYNTHETIC }}'; });
});

test('requires the existing OpenAI model and passes intact prompt as data only', () => {
  rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.model = 'openrouter/openai/gpt-luna'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.effort = '${{ inputs.effort }}'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[2].with.prompt = 'prefix ${{ inputs.prompt }}'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[2]['continue-on-error'] = true; });
});

test('rejects mutable or PR-head checkout and credential-preserving checkout', () => {
  rejectMutation((c) => { c.jobs.pullfrog.steps[0].uses = 'actions/checkout@v6'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[0].with['persist-credentials'] = true; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[0].with.ref = '${{ github.event.pull_request.head.sha }}'; });
  rejectMutation((c) => { c.jobs.pullfrog.steps[0].with = ['fetch-depth', 1]; });
});

test('rejects malformed or duplicate-key YAML rather than permissively scanning', () => {
  assert.throws(() => assertPullfrogWorkflowPolicy('on: [workflow_dispatch\n'), /YAML parsing failed/);
  assert.throws(() => assertPullfrogWorkflowPolicy(`${workflow}\npermissions: write-all\n`), /YAML parsing failed/);
  assert.throws(() => assertPullfrogWorkflowPolicy(null));
});
