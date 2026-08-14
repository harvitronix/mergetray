# MergeTray

MergeTray is a local-first GitHub review inbox. It stores its data in SQLite
and polls GitHub with credentials from the local `gh` CLI.

## Quick start

Prerequisites:

- Node.js 24.15 or newer (`.node-version` pins the tested version)
- pnpm 11
- [GitHub CLI](https://cli.github.com/)

```bash
git clone <repository-url>
cd mergetray
pnpm install
pnpm mergetray setup
pnpm mergetray open
```

`setup` opens GitHub's CLI login when needed, creates
`.mergetray/mergetray.sqlite`, and asks which `owner/repository` names to add. If
repositories are already selected, it shows them and then separately asks
which ones to remove. Adding a repository does not replace the existing
selection. Setup also offers real-time webhook updates, defaulting to disabled.
Open [http://localhost:3002](http://localhost:3002) afterward.

To use another port:

```bash
pnpm mergetray open --port 4000
```

To add or remove repositories non-interactively:

```bash
pnpm mergetray setup --add-repos owner/repo,another/repo
pnpm mergetray setup --remove-repos old-owner/old-repo
```

## CLI

```text
pnpm mergetray doctor
pnpm mergetray doctor --json
pnpm mergetray setup [--add-repos owner/repo,...] [--remove-repos owner/repo,...] [--webhooks|--no-webhooks] [--no-login]
pnpm mergetray open [--port 3002]
pnpm mergetray webhooks [--port 3002]
```

`doctor` checks the Node version, `gh`, GitHub authentication, SQLite, selected
repositories, and configured webhook forwarding. The action dispatcher is
intentionally small so future local maintenance commands can be added as
`pnpm mergetray <action>`. `open` starts the app on localhost only and keeps
running until you press Ctrl-C.

## Local-only and security model

MergeTray is a single-user local application, not a hosted service. The
supported `pnpm mergetray open` command binds the web server to `127.0.0.1`,
and there is no MergeTray account, cloud database, telemetry, or
application-level authentication. Do not expose the server to a network or put
it behind a public reverse proxy.

MergeTray makes outbound requests to GitHub and, when enabled, uses GitHub's
webhook forwarding service. Pull request metadata, cached GitHub responses,
notes, settings, and Codex task links are stored in the local SQLite database.
The database is not encrypted by MergeTray; protect it with your operating
system account permissions and disk encryption.

MergeTray gets a token from the active `gh` session when making GitHub requests
but does not save that token in SQLite. GitHub CLI owns credential storage; run
`gh auth status` to inspect the active account and storage location.

## GitHub access and scopes

`pnpm mergetray setup` uses GitHub CLI's standard login, whose minimum OAuth
scopes are:

- `repo` to read pull requests and related metadata, including private
  repositories the account can access;
- `read:org` to read team membership used for review requests;
- `gist`, which GitHub CLI requires but MergeTray does not use.

Normal polling reads GitHub data and does not post reviews, comments, or change
pull requests. Optional organization-level webhook forwarding requests
`admin:org_hook`. If that scope is unavailable, setup falls back to forwarding
the selected repositories individually. MergeTray can only see repositories
available to the active GitHub token.

## Optional Codex integration

MergeTray can suggest and link local Codex tasks whose repository and branch
match a pull request. The integration is disabled by default. Enable it from
Settings after installing the [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
and signing in with `codex`.

When enabled, the `codex` binary must be available on the server process's
`PATH`. MergeTray uses the experimental
[Codex app-server](https://learn.chatgpt.com/docs/app-server) protocol to read
local active and archived task metadata. Task scans are loaded when the Codex
section is opened and briefly cached; inbox renders do not start app-server.
Run `pnpm mergetray doctor` to check whether the CLI is available and whether
the integration is enabled.

## How polling stays efficient

Page loads and a five-minute browser timer request a sync only when the local
snapshot is stale. Manual refresh can force one immediately. A sync:

1. conditionally fetches the paginated open-PR list for each selected repo with
   ETags;
2. fetches PR details, reviews, commits, and timeline only for a new PR or one
   whose `updated_at` or head SHA changed;
3. refreshes volatile state for all open PRs in batched GraphQL queries, so
   checks, review requests, approvals, merges, and closes are reconciled without
   a many-request fan-out per PR.

Concurrent page loads share one in-process sync. A failed automatic poll waits
one minute before retrying. SQLite uses WAL mode, and user actions are local
database writes; they do not trigger GitHub queries. Snoozed items wake lazily
when the inbox is read.

## Optional webhook refreshes

GitHub webhooks can trigger targeted pulls while the five-minute sync remains
the recovery path. Webhook forwarding is disabled by default. Run setup again
and answer yes to enable it, or configure it non-interactively:

```bash
pnpm mergetray setup --webhooks
```

Setup installs GitHub's forwarding extension when needed. If every selected
repository belongs to one organization, it uses one organization forwarder and
requests `admin:org_hook` only when the current GitHub login does not already
have that scope. Otherwise it forwards each selected repository separately.

`pnpm mergetray open` starts and stops forwarding with the local app. If the
forwarding connection exits unexpectedly, MergeTray restarts it after five
seconds. Forwarding failure does not prevent the app from opening because
polling remains active. To run the configured listener separately for
troubleshooting:

```bash
pnpm mergetray webhooks --port 3002
```

Run setup again and answer no, or run `pnpm mergetray setup --no-webhooks`, to
disable forwarding.

The webhook only identifies the affected PR. MergeTray refetches it from GitHub
before updating SQLite, and open browser tabs refresh after the local data
changes. If the forwarder is stopped or misses an event, normal polling
reconciles it later.

## Supported operating systems

MergeTray supports macOS and Linux; CI runs on Ubuntu 24.04. Native Windows and
WSL are not currently tested or supported. The optional Codex integration also
requires a compatible local Codex installation.

## Local data, backups, and upgrades

The database and HTTP cache live in `.mergetray/`, which is ignored by Git. Set
`MERGETRAY_DATA_DIR` to use another directory:

```bash
MERGETRAY_DATA_DIR=/path/to/data pnpm mergetray setup
```

MergeTray does not create automatic backups. Stop the app and copy the entire
data directory to back it up; restore that complete directory while the app is
stopped. Delete it to reset the local inbox.

When upgrading a Git checkout, stop MergeTray, back up the data directory, pull
the new version, run `pnpm install --frozen-lockfile`, and restart. MergeTray
opens the existing database and applies its current schema declarations. There
is no automated downgrade or rollback tool, so keep the backup until the new
version has run successfully.

## Development

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run all checks with `pnpm check`.
