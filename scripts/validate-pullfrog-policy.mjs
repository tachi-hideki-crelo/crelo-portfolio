import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const WORKFLOW_URL = new URL('../.github/workflows/pullfrog.yml', import.meta.url);

const EXPECTED_ACTIONS = {
  checkout: 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
  pullfrog: 'pullfrog/pullfrog@ad4283a862b8377cb525a0f5bf30f17c023b18ea',
};

const EXPECTED_AGENT_ENV = {
  PULLFROG_FORCE_LOCAL_CLI: '1',
};

// The reviewed upstream Pullfrog 0.1.98 source still reports 17 unresolved
// advisories (6 high). Keep this local workflow disabled until a reviewed
// upstream release is validated and an intentional resume review is recorded.
const EXPECTED_PAUSE_EXPRESSION = '${{ false }}';

const isRecord = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
);

function policyError(path, message) {
  return new Error(`Pullfrog workflow policy violation at ${path}: ${message}`);
}

function requireRecord(value, path) {
  if (!isRecord(value)) {
    throw policyError(path, 'expected a plain YAML mapping');
  }
  return value;
}

function requireExactKeys(value, expected, path) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw policyError(path, `unexpected keys (expected exactly ${wanted.join(', ') || 'none'})`);
  }
}

function requireEqual(actual, expected, path) {
  if (actual !== expected) {
    throw policyError(path, 'value does not match the reviewed policy');
  }
}

function requireString(value, path) {
  if (typeof value !== 'string') {
    throw policyError(path, 'expected a string');
  }
}

function requireWorkflowShape(workflow) {
  requireRecord(workflow, 'root');
  requireExactKeys(workflow, ['name', 'run-name', 'on', 'permissions', 'jobs'], 'root');
  requireEqual(workflow.name, 'Pullfrog', 'name');
  requireEqual(workflow['run-name'], '${{ inputs.name || github.workflow }}', 'run-name');

  const trigger = requireRecord(workflow.on, 'on');
  requireExactKeys(trigger, ['workflow_dispatch'], 'on');
  const dispatch = requireRecord(trigger.workflow_dispatch, 'on.workflow_dispatch');
  requireExactKeys(dispatch, ['inputs'], 'on.workflow_dispatch');
  const inputs = requireRecord(dispatch.inputs, 'on.workflow_dispatch.inputs');
  requireExactKeys(inputs, ['prompt', 'name'], 'on.workflow_dispatch.inputs');
  for (const inputName of ['prompt', 'name']) {
    const input = requireRecord(inputs[inputName], `on.workflow_dispatch.inputs.${inputName}`);
    requireExactKeys(input, ['type', 'description'], `on.workflow_dispatch.inputs.${inputName}`);
    requireEqual(input.type, 'string', `on.workflow_dispatch.inputs.${inputName}.type`);
    requireString(input.description, `on.workflow_dispatch.inputs.${inputName}.description`);
  }

  const permissions = requireRecord(workflow.permissions, 'permissions');
  requireExactKeys(permissions, ['contents'], 'permissions');
  requireEqual(permissions.contents, 'read', 'permissions.contents');

  const jobs = requireRecord(workflow.jobs, 'jobs');
  requireExactKeys(jobs, ['pullfrog'], 'jobs');
  const job = requireRecord(jobs.pullfrog, 'jobs.pullfrog');
  requireExactKeys(job, ['if', 'runs-on', 'permissions', 'steps'], 'jobs.pullfrog');
  requireEqual(job.if, EXPECTED_PAUSE_EXPRESSION, 'jobs.pullfrog.if');
  requireEqual(job['runs-on'], 'ubuntu-latest', 'jobs.pullfrog.runs-on');

  const jobPermissions = requireRecord(job.permissions, 'jobs.pullfrog.permissions');
  requireExactKeys(jobPermissions, ['contents'], 'jobs.pullfrog.permissions');
  requireEqual(jobPermissions.contents, 'read', 'jobs.pullfrog.permissions.contents');

  if (!Array.isArray(job.steps) || job.steps.length !== 2) {
    throw policyError('jobs.pullfrog.steps', 'expected exactly the checkout and Pullfrog steps');
  }

  const checkout = requireRecord(job.steps[0], 'jobs.pullfrog.steps[0]');
  requireExactKeys(checkout, ['name', 'uses', 'with'], 'jobs.pullfrog.steps[0]');
  requireEqual(checkout.name, 'Checkout code', 'jobs.pullfrog.steps[0].name');
  requireEqual(checkout.uses, EXPECTED_ACTIONS.checkout, 'jobs.pullfrog.steps[0].uses');
  const checkoutWith = requireRecord(checkout.with, 'jobs.pullfrog.steps[0].with');
  requireExactKeys(checkoutWith, ['fetch-depth', 'persist-credentials'], 'jobs.pullfrog.steps[0].with');
  requireEqual(checkoutWith['fetch-depth'], 1, 'jobs.pullfrog.steps[0].with.fetch-depth');
  requireEqual(checkoutWith['persist-credentials'], false, 'jobs.pullfrog.steps[0].with.persist-credentials');

  const agent = requireRecord(job.steps[1], 'jobs.pullfrog.steps[1]');
  requireExactKeys(agent, ['name', 'uses', 'with', 'env'], 'jobs.pullfrog.steps[1]');
  requireEqual(agent.name, 'Run agent', 'jobs.pullfrog.steps[1].name');
  requireEqual(agent.uses, EXPECTED_ACTIONS.pullfrog, 'jobs.pullfrog.steps[1].uses');
  const agentWith = requireRecord(agent.with, 'jobs.pullfrog.steps[1].with');
  requireExactKeys(agentWith, ['prompt', 'push', 'shell'], 'jobs.pullfrog.steps[1].with');
  requireEqual(agentWith.push, 'restricted', 'jobs.pullfrog.steps[1].with.push');
  requireEqual(agentWith.shell, 'restricted', 'jobs.pullfrog.steps[1].with.shell');
  requireEqual(agentWith.prompt, '${{ inputs.prompt }}', 'jobs.pullfrog.steps[1].with.prompt');

  const env = requireRecord(agent.env, 'jobs.pullfrog.steps[1].env');
  requireExactKeys(env, Object.keys(EXPECTED_AGENT_ENV), 'jobs.pullfrog.steps[1].env');
  for (const [envName, expectedValue] of Object.entries(EXPECTED_AGENT_ENV)) {
    requireEqual(
      env[envName],
      expectedValue,
      `jobs.pullfrog.steps[1].env.${envName}`,
    );
  }

  return workflow;
}

export function assertPullfrogWorkflowPolicy(source) {
  if (typeof source !== 'string') {
    throw policyError('source', 'expected workflow YAML text');
  }

  let workflow;
  try {
    workflow = yaml.load(source, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    throw policyError('source', `YAML parsing failed (${error instanceof Error ? error.name : 'unknown error'})`);
  }

  return requireWorkflowShape(workflow);
}

export function validatePullfrogWorkflowFile(path = fileURLToPath(WORKFLOW_URL)) {
  const source = readFileSync(path, 'utf8');
  return assertPullfrogWorkflowPolicy(source);
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (entryPath === fileURLToPath(import.meta.url)) {
  validatePullfrogWorkflowFile();
  console.log('Pullfrog workflow policy: pass');
}
