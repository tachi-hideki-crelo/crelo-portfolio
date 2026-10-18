# Crelo / DeepSec

Official `vercel-labs/deepsec` **2.3.10**, in an isolated pnpm workspace.
Use Node 24+ for this tool workspace. The website itself keeps its npm lockfile and has no runtime dependency on
this tool. Install with `pnpm install --frozen-lockfile --ignore-scripts` here.
`pnpm-workspace.yaml` keeps the scanner's transitive `undici` at patched
8.10.2 and disables install scripts; verify this graph with `pnpm audit` too.
Do not run the default automatic initializer: local setup unexpectedly requested
Vercel authentication even for its plan. This manually configured, documented
scaffold path does not create a Vercel project or configure API credentials.

## Scope and privacy

The owner explicitly approved sending the 89-file source snapshot to OpenAI
using the existing Codex login on 2026-10-18. Local subscription usage consumes
that subscription's limits; only `scan` is a deterministic, non-AI command.
New API billing, cloud sandboxes and production operations are not approved.

`node prepare.mjs` copies tracked maintained source/config files to ignored
`scan-target/`, with a SHA-256 manifest. It excludes `.env*`, `.dev.vars*`,
`.claude/`, Git history, media, build output, dependencies and private intake
documents. It rejects symlink sources and common credential material without
printing values. This check is an additional guard, not a complete secret scanner.
Source/policy reads also reject shared inodes and redirected directory ancestors;
the opened file descriptor is checked before reading that same descriptor.
An inert `.git` marker prevents Git from walking up to the real repository;
it contains no original metadata or history and is checked by the verifier.
Review the generated manifest locally before any subsequent AI run, particularly
if the source set changes. Do not broaden external sharing without approval.

A snapshot is **not** a security sandbox. The official Codex backend disables
shell networking/plugins and uses a temporary Codex home, but its local SDK
uses workspace-write mode. Thus analysis is performed only against the copy,
the prompt prohibits mutations, and `node verify.mjs` must confirm unchanged
source hashes afterward. Never analyze original production credentials/data.

## Commands (from this directory)

1. `pnpm run check`
2. `pnpm run prepare:source`
3. Review `data/crelo-portfolio/manifest.json` and `source-files.txt` locally.
4. `pnpm run scan` — built-in regex candidate detection, not a clean verdict.
5. AI review of the entire approved list, including files with no regex hit:

   ```sh
   pnpm run process \
     --files-from data/crelo-portfolio/source-files.txt --no-ignore \
     --concurrency 2 --batch-size 6 --max-turns 40
   ```

6. `pnpm run verify:source`
7. Validate each finding and fix original source with isolated regression tests.
8. Refresh the approved snapshot and run `pnpm run revalidate` with credentials
   routed to the same local subscription; verify hashes again.
9. `node run.mjs export --project-id crelo-portfolio --format json --include-resolved --out data/crelo-portfolio/reports/findings.json`

The runner uses a clean allowlisted environment (no provider API keys, gateway
tokens, alternate base URLs or NODE_OPTIONS), permits only reviewed per-command
arguments for this fixed project, rejects all local `.env*`/`.dev.vars*` files,
and validates the same subscription-only JSON policy
as the DeepSec configuration. Do not bypass it to configure billable routes.
Analysis commands automatically verify the source copy before and after the
child process. The parent process retains the original list/hash/policy digest
in memory, so rewriting a source together with its manifest cannot erase the
comparison baseline. The explicit verification step also produces a readable
record. Output paths are limited to ignored project JSON reports and checked
for symlink redirection, shared hardlinks and non-file destinations. The source
preparer validates the unshared, canonical policy file before reading it or
creating the snapshot. Local INFO/revalidation logs are ignored too.
Before AI operations, the wrapper also requires `codex login status` to confirm
ChatGPT authentication; it refuses saved API-key authentication without echoing
credentials. Subscription usage is not a promise of unlimited or free usage.
The omitted `drizzle/meta` snapshots, new migration files, test fixtures and
tooling implementation are reviewed with the independent full diff and local
regression tests, not claimed as part of the original 89-file AI review.

Direct mode exit **1** means findings, not a runtime failure. Exit **0** is
insufficient without completed batches, output tokens, current hashes and no
refusals. Preserve JSON evidence: DeepSec's Markdown export can mislabel a
`fixed` revalidation as `uncertain`. Do not manually edit verdicts.

Generated snapshots, reports and logs stay ignored; do not upload vulnerability
details, credential metadata or model session logs to public artifacts. Run root
lint, typecheck, tests, production build and dependency audit after remediation.
GitHub push and production deployment require a separate user request.
