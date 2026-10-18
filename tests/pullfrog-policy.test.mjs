import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { assertPullfrogWorkflowPolicy } from '../scripts/validate-pullfrog-policy.mjs';

const workflow = readFileSync(new URL('../.github/workflows/pullfrog.yml', import.meta.url), 'utf8');

test('Pullfrog workflow satisfies the fail-closed security policy', () => {
  assert.doesNotThrow(() => assertPullfrogWorkflowPolicy(workflow));
});

test('rejects block, flow-map, quoted, and array-valued extra triggers', () => {
  const fixtures = [
    workflow.replace(
      /^  workflow_dispatch:/m,
      '  pull_request: {}\n  workflow_dispatch:',
    ),
    workflow.replace(
      /^on:\n[\s\S]*?(?=^permissions:)/m,
      'on: { workflow_dispatch: {}, pull_request: {} }\n\n',
    ),
    workflow.replace(
      /^  workflow_dispatch:/m,
      "  'pull_request': {}\n  workflow_dispatch:",
    ),
    workflow.replace(
      /^on:\n[\s\S]*?(?=^permissions:)/m,
      'on: [workflow_dispatch, pull_request]\n\n',
    ),
  ];

  for (const fixture of fixtures) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('rejects nested trigger or environment keys that could bypass the reviewed boundary', () => {
  const nestedOn = workflow.replace(
    /^  pullfrog:\n/m,
    '  pullfrog:\n    env:\n      on: push\n',
  );
  const nestedInput = workflow.replace(
    /^          prompt: \$\{\{ inputs\.prompt \}\}$/m,
    '          inputs: { push: unrestricted }\n          prompt: ${{ inputs.prompt }}',
  );
  const extraEnv = workflow.replace(
    /^          PULLFROG_FORCE_LOCAL_CLI:/m,
    '          ACTIONS_RUNTIME_TOKEN: ${{ secrets.ACTIONS_RUNTIME_TOKEN }}\n          PULLFROG_FORCE_LOCAL_CLI:',
  );

  for (const fixture of [nestedOn, nestedInput, extraEnv]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('rejects all provider secret references while the workflow is paused', () => {
  const otherProvider = workflow.replace(
    '          PULLFROG_FORCE_LOCAL_CLI: "1"',
    '          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}\n          PULLFROG_FORCE_LOCAL_CLI: "1"',
  );

  assert.throws(() => assertPullfrogWorkflowPolicy(otherProvider));
});

test('requires the exact fail-closed pause and rejects resume or permission bypasses', () => {
  const stringTrue = workflow.replace('    if: ${{ false }}', '    if: true');
  const quotedTrue = workflow.replace('    if: ${{ false }}', '    if: "true"');
  const mixedExpression = workflow.replace(
    '    if: ${{ false }}',
    '    if: ${{ false }} || true',
  );
  const flowJob = workflow.replace(
    /  pullfrog:\n[\s\S]*$/m,
    '  pullfrog: { if: "${{ false }}", runs-on: ubuntu-latest, permissions: { contents: read, id-token: write }, steps: [] }\n',
  );
  const secretEnv = workflow.replace(
    '          PULLFROG_FORCE_LOCAL_CLI: "1"',
    '          PULLFROG_FORCE_LOCAL_CLI: "1"\n          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}',
  );
  const jobToken = workflow.replace(
    '      contents: read\n    steps:',
    '      contents: read\n      id-token: write\n    steps:',
  );

  for (const fixture of [stringTrue, quotedTrue, mixedExpression, flowJob, secretEnv, jobToken]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('requires the fixed local Pullfrog runtime flag and rejects weaker forms', () => {
  const missingRuntimeFlag = workflow.replace('          PULLFROG_FORCE_LOCAL_CLI: "1"\n', '');
  const disabledRuntimeFlag = workflow.replace(
    '          PULLFROG_FORCE_LOCAL_CLI: "1"',
    '          PULLFROG_FORCE_LOCAL_CLI: "0"',
  );
  const secretRuntimeFlag = workflow.replace(
    '          PULLFROG_FORCE_LOCAL_CLI: "1"',
    '          PULLFROG_FORCE_LOCAL_CLI: ${{ secrets.PULLFROG_FORCE_LOCAL_CLI }}',
  );

  for (const fixture of [missingRuntimeFlag, disabledRuntimeFlag, secretRuntimeFlag]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('rejects unrestricted push values and flow/array permission bypasses', () => {
  const unrestrictedPush = workflow.replace('push: restricted', 'push: unrestricted');
  const flowPush = workflow.replace(
    '          push: restricted\n          shell: restricted\n          prompt: ${{ inputs.prompt }}',
    '          with: { push: unrestricted, prompt: ${{ inputs.prompt }} }',
  );
  const writablePermissions = workflow.replace('  contents: read', '  contents: write');
  const arrayPermissions = workflow.replace(
    'permissions:\n  contents: read',
    'permissions: [contents, write]',
  );

  for (const fixture of [unrestrictedPush, flowPush, writablePermissions, arrayPermissions]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('requires restricted shell permission and rejects weaker or malformed forms', () => {
  const shellEnabled = workflow.replace('shell: restricted', 'shell: enabled');
  const shellMissing = workflow.replace('          shell: restricted\n', '');
  const shellArray = workflow.replace(
    '          shell: restricted\n          prompt: ${{ inputs.prompt }}',
    '          shell: [restricted]\n          prompt: ${{ inputs.prompt }}',
  );
  const shellNested = workflow.replace(
    '          shell: restricted\n          prompt: ${{ inputs.prompt }}',
    '          shell:\n            permission: restricted\n          prompt: ${{ inputs.prompt }}',
  );

  for (const fixture of [shellEnabled, shellMissing, shellArray, shellNested]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('rejects mutable checkout refs and credential-preserving checkout forms', () => {
  const mutableCheckout = workflow.replace(
    'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
    'actions/checkout@v6',
  );
  const credentialsPreserved = workflow.replace('persist-credentials: false', 'persist-credentials: true');
  const checkoutWithArray = workflow.replace(
    'with:\n          fetch-depth: 1',
    'with: [fetch-depth, 1]',
  );

  for (const fixture of [mutableCheckout, credentialsPreserved, checkoutWithArray]) {
    assert.throws(() => assertPullfrogWorkflowPolicy(fixture));
  }
});

test('rejects malformed YAML instead of falling back to a permissive scan', () => {
  assert.throws(
    () => assertPullfrogWorkflowPolicy('on: [workflow_dispatch\n'),
    /YAML parsing failed/,
  );
});
