import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const WORKFLOW_URL = new URL('../.github/workflows/pullfrog.yml', import.meta.url);

const EXPECTED_ACTIONS = {
  checkout: 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
  pullfrog: 'tachi-hideki-crelo/pullfrog-security@5fd66c952a0c1abd5ce9fb8afec3d93c04bbc2c7',
};

const EXPECTED_AGENT_ENV = {
  PULLFROG_FORCE_LOCAL_CLI: '1',
};

const EXPECTED_RUN_EXPRESSION = "${{ github.repository == 'tachi-hideki-crelo/crelo-portfolio' && github.ref == 'refs/heads/main' }}";
const EXPECTED_CONCURRENCY_GROUP = 'pullfrog-review-${{ github.repository }}-${{ fromJSON(inputs.prompt).event.issue_number || github.run_id }}';

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
  requireExactKeys(job, ['if', 'runs-on', 'timeout-minutes', 'concurrency', 'permissions', 'steps'], 'jobs.pullfrog');
  requireEqual(job.if, EXPECTED_RUN_EXPRESSION, 'jobs.pullfrog.if');
  requireEqual(job['runs-on'], 'ubuntu-24.04', 'jobs.pullfrog.runs-on');
  requireEqual(job['timeout-minutes'], 20, 'jobs.pullfrog.timeout-minutes');
  const concurrency = requireRecord(job.concurrency, 'jobs.pullfrog.concurrency');
  requireExactKeys(concurrency, ['group', 'cancel-in-progress'], 'jobs.pullfrog.concurrency');
  requireEqual(concurrency.group, EXPECTED_CONCURRENCY_GROUP, 'jobs.pullfrog.concurrency.group');
  requireEqual(concurrency['cancel-in-progress'], false, 'jobs.pullfrog.concurrency.cancel-in-progress');

  const jobPermissions = requireRecord(job.permissions, 'jobs.pullfrog.permissions');
  requireExactKeys(jobPermissions, ['contents', 'id-token'], 'jobs.pullfrog.permissions');
  requireEqual(jobPermissions.contents, 'read', 'jobs.pullfrog.permissions.contents');
  requireEqual(jobPermissions['id-token'], 'write', 'jobs.pullfrog.permissions.id-token');

  if (!Array.isArray(job.steps) || job.steps.length !== 3) {
    throw policyError('jobs.pullfrog.steps', 'expected exactly checkout, dispatch validation and Pullfrog');
  }

  const checkout = requireRecord(job.steps[0], 'jobs.pullfrog.steps[0]');
  requireExactKeys(checkout, ['name', 'uses', 'with'], 'jobs.pullfrog.steps[0]');
  requireEqual(checkout.name, 'Checkout code', 'jobs.pullfrog.steps[0].name');
  requireEqual(checkout.uses, EXPECTED_ACTIONS.checkout, 'jobs.pullfrog.steps[0].uses');
  const checkoutWith = requireRecord(checkout.with, 'jobs.pullfrog.steps[0].with');
  requireExactKeys(checkoutWith, ['fetch-depth', 'persist-credentials'], 'jobs.pullfrog.steps[0].with');
  requireEqual(checkoutWith['fetch-depth'], 1, 'jobs.pullfrog.steps[0].with.fetch-depth');
  requireEqual(checkoutWith['persist-credentials'], false, 'jobs.pullfrog.steps[0].with.persist-credentials');

  const guard = requireRecord(job.steps[1], 'jobs.pullfrog.steps[1]');
  requireExactKeys(guard, ['name', 'run', 'env'], 'jobs.pullfrog.steps[1]');
  requireEqual(guard.name, 'Validate review dispatch', 'jobs.pullfrog.steps[1].name');
  requireEqual(guard.run, 'node scripts/validate-pullfrog-dispatch.mjs', 'jobs.pullfrog.steps[1].run');
  const guardEnv = requireRecord(guard.env, 'jobs.pullfrog.steps[1].env');
  requireExactKeys(guardEnv, ['PULLFROG_DISPATCH'], 'jobs.pullfrog.steps[1].env');
  requireEqual(guardEnv.PULLFROG_DISPATCH, '${{ inputs.prompt }}', 'jobs.pullfrog.steps[1].env.PULLFROG_DISPATCH');

  const agent = requireRecord(job.steps[2], 'jobs.pullfrog.steps[2]');
  requireExactKeys(agent, ['name', 'uses', 'with', 'env'], 'jobs.pullfrog.steps[2]');
  requireEqual(agent.name, 'Run agent', 'jobs.pullfrog.steps[2].name');
  requireEqual(agent.uses, EXPECTED_ACTIONS.pullfrog, 'jobs.pullfrog.steps[2].uses');
  const agentWith = requireRecord(agent.with, 'jobs.pullfrog.steps[2].with');
  requireExactKeys(agentWith, ['prompt', 'push', 'shell', 'model', 'effort', 'timeout'], 'jobs.pullfrog.steps[2].with');
  requireEqual(agentWith.push, 'disabled', 'jobs.pullfrog.steps[2].with.push');
  requireEqual(agentWith.shell, 'restricted', 'jobs.pullfrog.steps[2].with.shell');
  requireEqual(agentWith.model, 'openai/gpt-luna', 'jobs.pullfrog.steps[2].with.model');
  requireEqual(agentWith.effort, 'high', 'jobs.pullfrog.steps[2].with.effort');
  requireEqual(agentWith.timeout, '15m', 'jobs.pullfrog.steps[2].with.timeout');
  requireEqual(agentWith.prompt, '${{ inputs.prompt }}', 'jobs.pullfrog.steps[2].with.prompt');

  const env = requireRecord(agent.env, 'jobs.pullfrog.steps[2].env');
  requireExactKeys(env, Object.keys(EXPECTED_AGENT_ENV), 'jobs.pullfrog.steps[2].env');
  for (const [envName, expectedValue] of Object.entries(EXPECTED_AGENT_ENV)) {
    requireEqual(
      env[envName],
      expectedValue,
      `jobs.pullfrog.steps[2].env.${envName}`,
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
