# MergeTray screenshot reference

50 screenshots captured September 24, 2026 at 1440 × 1000.

These screenshots preserve the September 24 wireframe as a guide to flows and information hierarchy. They are not a pixel-perfect specification. All issues, commands, sessions, metrics, and integrations shown are simulated.

Known follow-up: move the bottom navigation controls into a flyout from the name. The controls visible in these screenshots are not the intended final navigation. Working-folder creation, isolation, and sharing are still design hypotheses.

Open [the visual gallery](index.html) in a browser, or use the links below. The gallery and PNGs work offline. See also the [product spec](../../PRODUCT-SPEC.md).

## Orientation

- [01 · Workspace overview](01-workspace.png) — All projects, recursive stream navigation, return-to-work brief, and the workspace companion.
- [02 · Project cards and recent activity](02-project-cards.png) — The lower part of the overview, including work grouped by project.
- [03 · Across projects by readiness](03-readiness.png) — One tree reordered by readiness rather than separated by project.
- [04 · One project in focus](04-project-filter.png) — Project filtering keeps the same navigation and stream model.
- [05 · Needs your input](05-needs-you.png) — Reviews and product decisions collected in one view.
- [06 · Workspace activity](06-activity.png) — A timeline of sessions, decisions, and delivery events.
- [18 · Find an existing stream](18-search.png) — Workspace search supports subjects and issue references.

## Companion

- [07 · Workspace companion](07-workspace-companion.png) — Scripted example of asking what needs attention across projects.
- [09 · Return after time away](09-stream-catchup.png) — The companion summarizes previous sessions and PRs and offers a next step.

## Streams

- [08 · Stream overview](08-stream-overview.png) — The parent stream retains intent, next action, working environment, and artifacts.
- [10 · Children, decisions, and sources](10-stream-context.png) — The lower overview preserves recursive work and links to original context.
- [19 · Change stream status](19-status.png) — Explicit stream state remains distinct from individual PR and agent state.
- [39 · An idea before coding](39-idea-stream.png) — A stream can retain intent and decisions before any folder or coding session exists.
- [50 · Overview with companion collapsed](50-focused-overview.png) — A wider working area when the companion is not needed.

## Environments

- [11 · Child stream and shared environment](11-shared-environment.png) — The child visibly shares its parent’s folder while retaining its own context.
- [20 · Choose a working folder](20-environment-association.png) — Explore a separate stream folder, project checkout, or parent sharing. These choices remain open.
- [21 · Ordinary stream terminal](21-stream-terminal.png) — A shell associated with the stream’s folder, separate from coding-agent sessions. All commands are simulated.
- [22 · Running web environment](22-running-environment.png) — The overview exposes the preview entry point and process controls.
- [23 · Web product preview](23-web-preview.png) — A sample checkout can be tried without leaving the workspace.
- [24 · Review environment cleanup](24-cleanup.png) — The mock explains running work or sharing before allowing retirement.
- [38 · Another stream’s dev preview](38-calendar-preview.png) — A second web project entry point stays tied to its own working environment.
- [40 · Terminal before environment setup](40-unprepared-terminal.png) — The mock prompts for an environment when the stream has no working folder.
- [44 · A mobile project stream](44-mobile-stream.png) — The same overview points to a simulator instead of a web preview.
- [45 · Simulator entry point](45-simulator.png) — A local mock of the mobile product, shown within the workspace.
- [46 · Try the mobile flow offline](46-simulator-offline.png) — The simulated app saves a note locally and waits to sync.

## Sources

- [12 · Linked issue context](12-linear-source.png) — An issue’s description and acceptance criteria are available within the stream.
- [13 · Linked discussion](13-slack-source.png) — A product decision remains attached to its original discussion.

## Creation

- [14 · Create a child stream](14-child-stream.png) — The creation form can place new work inside another stream.
- [15 · Create a stream](15-new-stream.png) — One creation flow supports an idea or a referenced external issue.
- [16 · Prefill from Linear](16-linear-import.png) — A sample Linear reference supplies editable title, description, and project.
- [17 · Prefill from GitHub](17-github-import.png) — A sample GitHub issue switches the suggested project to Trail Notes.

## Agents

- [25 · Multiple agent sessions](25-agents.png) — Claude Code and Codex attempts remain attached to the same stream.
- [26 · Start an agent session](26-start-agent.png) — Choose a provider and initial instruction, with conversation or terminal presentation.
- [27 · Agent conversation](27-agent-chat.png) — An existing coding session can be reviewed and continued.
- [28 · Agent terminal presentation](28-agent-terminal.png) — The same agent session viewed in its terminal interface.
- [37 · Agent still working](37-running-agent.png) — An active session can receive follow-up instructions or finish a simulated turn.
- [41 · No coding sessions yet](41-empty-agents.png) — The empty state offers the first coding session without losing stream context.

## Delivery

- [29 · Pull requests on a stream](29-pull-requests.png) — PRs are attached artifacts with independent delivery states.
- [30 · Review a pull request](30-pr-review.png) — Checks, illustrative diff, preview, and merge action gathered in context.
- [31 · Merged, waiting for deployment](31-monitor-awaiting.png) — The merge hook attaches a monitor; merge alone does not mean verified.
- [32 · Deployment under observation](32-monitor-observing.png) — Production observation and flow verification are separate steps.
- [33 · Verified delivery](33-monitor-verified.png) — A simulated completed monitor supplies outcome evidence.
- [34 · Stream delivery history](34-stream-activity.png) — Merge, deployment, and verification events remain attached to the work.
- [42 · No pull requests yet](42-empty-prs.png) — Streams can exist and be useful before producing a PR.
- [43 · No monitors yet](43-empty-monitors.png) — The monitor empty state explains the relationship to delivery.

## Decisions

- [35 · A stream awaiting a decision](35-decision-needed.png) — An unresolved product choice is surfaced as the next action.
- [36 · Resolve a product decision](36-decision-dialog.png) — The choice becomes context for the next implementation session.

## Automation

- [47 · Hooks and automations](47-hooks.png) — External events trigger actions on streams through the same conceptual interface.
- [48 · Event replay and execution history](48-hook-replay.png) — Replaying the already-merged PR event avoids duplicate work.

## Workspace

- [49 · Workspace settings](49-settings.png) — Sample connected sources, coding agents, and companion scope. Bottom controls are slated to move into a name flyout.

## Capture details

Screens were reached through the mock UI in a separate browser session. Transient notifications were allowed to clear before capture. No live services or real shell commands were triggered.

The sequence includes scrolling within the overview, then a simulated PR merge → deployment → verification. Different screenshots therefore show different moments in the same flow. Sample text, counts, and metrics are illustrative; wording and implementation shortcuts are not requirements.

`manifest.json` records the screenshot order and captions. `capture.json` records source fingerprints, viewport, and branch; the captured source includes uncommitted prototype revisions beyond the base commit.
