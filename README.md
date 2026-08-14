# MergeTray

MergeTray helps you track, build, and deploy PRs across repos, faster,
by treating your PRs like a proper inbox. 
It's like a Mission Control for you and your teams' open PRs.

## Features

- Makes keeping tracking of dozens of PRs across dozens of repos enjoyable
- Snooze, keep an eye on CI checks, see PR size and timeline at a glance
- Mark PRs as Handled, don't see them again until they need attention
- See what's ready for your attention, ignore, snooze or "Handle" what's not
- Fully local - no cloud anything, just runs on your machine
- No deep integrations - don't need a GitHub app or token, just use your CLI
- Real-time updates - listens to webhooks (optional) and syncs every 5 minutes (dfault + fallback)
- Small Codex (ChatGPT) tie-in - open session threads from MergeTray locally

## Why not (some other tool)?

- GitHub Inbox - honesty, it's terrible
- Linear Inbox - it's generally good, but doesn't give me all the info I want up front
- Graphite - same, this is my favorite of the bunch, but I want more info at a glance

## Quick start

Prerequisites:

- Node.js 24.15 or newer (`.node-version` pins the tested version)
- pnpm 11
- [GitHub CLI](https://cli.github.com/)

```bash
git clone https://github.com/harvitronix/mergetray
cd mergetray
pnpm install
pnpm mergetray setup
pnpm mergetray open
```

Open [http://localhost:3002](http://localhost:3002) to use.

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

## Security

MergeTray is a single-user local application. The
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

MergeTray does not write anything to GitHub, it only reads. All data it needs
is stored locally in the SQLite database.

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

When enabled, the `codex` binary must be available on your local
`PATH`. MergeTray uses the experimental
[Codex app-server](https://learn.chatgpt.com/docs/app-server) protocol to read
local active and archived task metadata. Task scans are loaded when the Codex
section is opened and briefly cached.
Run `pnpm mergetray doctor` to check whether the CLI is available and whether
the integration is enabled.

## Optional webhook refreshes

GitHub webhooks can trigger targeted pulls - disabled by default.
You can enable it through the interactive setup, or directly with:

```bash
pnpm mergetray setup --webhooks
```

## Data

The database and HTTP cache live in `.mergetray/`, which is ignored by Git. Set
`MERGETRAY_DATA_DIR` to use another directory:

```bash
MERGETRAY_DATA_DIR=/path/to/data pnpm mergetray setup
```

## Development

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run all checks with `pnpm check`.

## Roadmap/Future

- Linear integration
- Claude Code integration
- Remote database support to use across devices
- More direct control over PRs from within MergeTray, like enabling automerge (though we're currently intentionally read only)

## Contributing

Feel free to log an issue or open a PR.
