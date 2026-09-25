# MergeTray v2: a home for ongoing work

Working product spec · September 24, 2026

This records the product direction, the decisions made so far, the initial technical direction, and the questions still open. It is not a detailed implementation plan. The wireframe in this folder is disposable; its data model, terminology, and shortcuts are not production requirements.

## What this is

MergeTray v2 is a full pivot. The name is the main thing it shares with the current MergeTray. Using the PR inbox showed that the thing actually wanted was a home for streams of work, of which a pull request is one artifact. v2 starts from first principles rather than repurposing the inbox.

v2 is a new application in a new repository. The current MergeTray (the Next.js PR inbox) stays runnable in its existing repository and is archived. Its code is not reused. Its data is not migrated. What carries over is knowledge: the Codex App Server protocol handling, the worktree recovery cases, and the inbox's event-driven readiness rules.

## The problem

Several projects are active at once. Ideas, discussions, coding sessions, terminals, dev environments, issues, and pull requests live in different places. Returning to a piece of work requires searching those places to reconstruct what happened and what to do next.

MergeTray should preserve that context and provide a useful place to continue. Work may happen in other applications; it must remain understandable here.

### The central product test

With several streams underway, can I select any one of them and understand where I am and what to do next, without searching another platform?

The test should hold after an hour away, a week away, or a month away. It should also hold for an idea that has never produced code, and for a teammate's pull request that only needs my review.

## Settled direction

- The organizing unit is the work being pursued. A pull request is one artifact of that work.
- Use **streams** in the interface. Streams may contain other streams recursively. A bug, a large effort, and a teammate's PR use the same underlying concept.
- A project is one repository. Adding a repository is adding a project.
- A stream that needs local files gets exactly one working environment, which is one git worktree. All sessions in that stream share it. One stream per worktree, never one agent per worktree.
- Streams carry an attention state (active, snoozed, done), so readiness ordering and snoozing from the v1 inbox apply to every stream.
- Readiness, needed input, and next action are computed deterministically from recorded events. No model runs automatically. Model-generated summaries are click-to-generate.
- Keep both project-specific views and an all-project view ordered by what is ready or needs attention.
- Build a macOS application with Tauri 2, a web UI, and a Rust application core. Rust is a requirement by preference, not by comparison; the architecture follows from it.
- Give each stream an isolated companion conversation with visibility into that stream, its descendants, and its ancestors' intent and decisions. Defer the app-wide companion until the stream workflow works.
- Support different coding agents. Terminal-first integration and reuse of an existing coding UI remain viable options.
- Begin with human-initiated actions. Design those actions so agents, hooks, and external events can invoke them later. Pull request sync is the one deterministic exception: it may create and update streams.
- Give each active stream clear access to its working folder, terminal, and development environment.
- Do not expect local work to continue while the Mac is asleep or offline.
- Keep creation simple: one plus button beside **Streams**, with the ability to fill out a stream from a linked external issue.

## Concepts and their purpose

| Concept | Purpose | Relationships |
| --- | --- | --- |
| Project | Represent one repository and hold its defaults | Contains streams; records the GitHub repository, local clone path, default branch, and later a dev recipe |
| Stream | Preserve intent, context, decisions, current state, next action, and attention state | Belongs to at most one project; may contain streams, sessions, issue links, PRs, decisions, monitors, and at most one working environment |
| Working environment | Identify where files, processes, and execution belong | One git worktree owned by exactly one stream; created when the stream first needs local files; shared by all sessions in that stream |
| Agent session | Perform a particular attempt at research, implementation, or review | Attached to a stream; uses the stream's environment when code is involved |
| Terminal | Run ordinary commands in the correct working folder | Available without starting a coding agent; attached to an environment |
| Dev environment | Run and inspect the thing being built | Has a lifecycle and an appropriate entry point, such as a browser preview or simulator; started from the project's dev recipe |
| Pull request | Review and integrate a code change | Belongs to exactly one stream; a stream can have several, with independent checks, review, and merge states |
| Decision | Record a choice that blocks or shapes the work | Raised on a stream by the user or by a session; open until the user resolves it; counts as needed input |
| Event | Record something that happened, from GitHub, a session, a monitor, or the user | Attached to a stream; the sole input to readiness rules |
| Monitor | Collect evidence after deployment | Attached to the relevant change and stream; distinguishes observation from verification |
| Companion conversation | Recover context, decide next steps, and operate the app | Scoped and isolated to one stream; an app-wide companion is deferred |
| Action | The one interface through which the UI, companion, and hooks change state | Every invocation is logged with its actor (human, companion, hook, sync), arguments, and outcome |
| Hook | Turn an external or internal event into an action | Uses the action interface; deferred past the first slice |

## Data model

### Projects and repositories

A project is one repository. It records:

- The GitHub repository (owner and name).
- The path to the user's existing local clone. The app registers it; it does not create it.
- The default branch.
- Later, a dev recipe: how to start the dev environment and which port or simulator it uses.

Worktrees share the registered clone's git directory. If that clone is moved or deleted, every worktree for the project breaks. The app must detect this and report it rather than silently switching to another checkout. Owning a bare clone per project instead is a possible later change, not a first-version requirement.

### Streams

A stream records intent, a title, an optional source link (issue or PR), an attention state, a parent, and a project. Rules:

- A stream belongs to at most one project. A stream with no project is a cross-project parent.
- Streams form a containment tree. Children may belong to a different project than their parent. This is how one effort spans several repositories: a project-less parent with one child per repository.
- A stream's origin is recorded: created by the user, imported from an issue, or synthesized from a pull request by sync.

### Attention state

Every stream is active, snoozed, or done.

- **Active** streams participate in readiness ordering.
- **Snoozed** streams are hidden from readiness ordering until a chosen time or until new activity on the stream, matching the v1 inbox's snooze. Snoozed children are excluded from parent rollups.
- **Done** is set explicitly by the user. For a synthetic PR stream it is set automatically when the PR merges or closes.

### Working environments

- An environment is one git worktree under a managed directory, for example `~/.mergetray/worktrees/<project>/<stream>`, on a branch named for the stream.
- It is created lazily, when a stream first starts a coding session, terminal, investigation, or other task that needs local files. Pure ideas need no environment.
- All sessions in the stream share it. Two sessions collaborating on one pull request use one checkout, as two people would.
- A child stream in the same project gets its own worktree. There is no parent-child sharing of environments. The child's base is the parent's branch when the parent has an environment, otherwise the project's default branch. Stacked PRs follow from this.
- The base is taken from the fetched remote default branch, not the local one, so new streams do not start from stale code.
- Retiring an environment removes the worktree and keeps the branch. Recreating an environment is a new worktree from the recorded repository and branch.

Sessions sharing one worktree cannot safely edit files at the same time. The app should refuse or clearly warn when a second session would enter the working state while another session in the same environment is already working. Sequential handoff, such as one agent implementing and another reviewing, is the intended pattern.

### Pull requests

- A pull request belongs to exactly one stream.
- Sync attaches a PR to an existing stream when the PR's head branch matches that stream's branch. Only when no stream matches does sync create a synthetic stream for it.
- Synthetic streams are how teammates' PRs enter the app. They replace the v1 inbox. They have no environment unless the user chooses to check the PR out, at which point a worktree is created on the PR's branch and local agent review becomes available.
- A PR is discovered by branch name after a session opens it, or by repository sync for PRs opened elsewhere. It is refreshed by polling. There are no webhooks in the first version because the app exposes no local server.

### Events and readiness

Readiness is computed from recorded events with deterministic rules, in the style of the v1 inbox's section rules. Events include:

- PR: review requested, changes requested, checks failed, checks passed, approved, mergeable, merged, closed.
- Session: waiting for approval, waiting for input, turn finished, failed, interrupted.
- Decision: raised, resolved.
- Monitor: started, observed, verified, failed.
- User: snoozed, marked done, note added.

Each rule yields a readiness category and a next-action label, such as "address review," "approve the agent's command," or "resolve decision." A stream's readiness is the highest-priority match across its own events and those of its active descendants. A parent shows counts and exceptions from its descendants; a single green child does not imply the parent is complete.

The next action shown on the overview is the winning rule's label. A model is not required to compute it.

## Feature goals and acceptance examples

### 1. Recover and continue work

The stream overview explains the intent, last meaningful result, ongoing work, unresolved decisions, and next useful action. It also links to supporting evidence and the right place to continue.

The overview must be useful before opening any links. A page of bookmarks or a combined transcript does not satisfy the central test.

The deterministic parts of the overview (sessions and their states, PRs and their states, open decisions, readiness, next action) are always current. A model-generated narrative summary is produced only when the user asks for it. It carries the time it was generated and the sources it drew from, and it stays visible, marked stale, when later events arrive.

Acceptance example: open checkout after a month and learn that three coding sessions ran, one PR merged and was verified, another PR is waiting for review, and the next action is inspecting that preview. All of that is visible without generating a summary.

### 2. Organize projects and recursive streams

- Work within one project or see all projects together.
- Group streams by project when navigating by subject. Project-less parents appear in a cross-project group.
- View streams across projects by readiness, needed input, or ongoing work. Snoozed streams are hidden from these views.
- Expand descendants without losing the parent context.
- Show useful counts and exceptions at parents, including deeply nested work.
- Allow a parent to have its own conversations, sessions, and artifacts.

Acceptance example: a parent with many descendants identifies the two decisions that need attention, the session still running, and the change still being monitored.

The project selector and grouping controls are views of the same work. Switching views must not duplicate or relocate it. Avoid a growing list of separate navigation destinations for every project and state.

### 3. Capture or import a stream

The plus beside **Streams** opens one creation flow. Start with a freeform idea or reference a GitHub issue, Linear issue, or another supported source.

When a source is resolved, populate the available title, description, source link, and project information. Show the result before creation and allow edits. A companion may help interpret or enrich it, but imported source facts should remain attributable.

Acceptance examples:

- Paste a GitHub issue and get an editable populated form with the project chosen from the repository.
- Paste a Linear issue and get the same.
- Create an idea with no repository, issue, or working folder.
- Create a child stream under an existing stream, in the same or a different project.
- Encounter an inaccessible issue without having invented details filled in.
- Import an already-linked issue and be offered the existing stream.
- See a teammate's PR appear as a synthetic stream after sync, snooze it, and have it return when the PR changes.

Source synchronization, write-back, and handling conflicting edits remain open.

### 4. Associate work with a working folder

The user should not have to remember which checkout belongs to which stream. Agents, terminals, and dev processes open in the environment of the selected stream.

The overview should expose enough context to prevent mistakes: environment state, repository and branch, base branch, and a way to inspect, retire, or recreate the environment.

Acceptance examples:

- Start a session from an idea; the worktree is created before coding begins.
- Open the terminal from that stream and land in the same working folder.
- Return later and reconnect to the existing environment.
- Create a child stream and see its worktree based on the parent's branch.
- Detect a missing or broken worktree instead of silently switching to an unrelated checkout.

### 5. Run and reopen development environments

Expose the associated dev environment directly on the overview and from the terminal. Show whether it is absent, preparing, running, stopped, or failed. Provide its entry point when usable.

The project's dev recipe defines how to start it. The recipe must allow the app to assign a port or simulator per environment, because two worktrees of the same project will otherwise collide on the project's default port.

For a web project, the entry point can be a local preview. For a mobile project, it can open the relevant simulator. Other project types may have different launch or inspection actions.

Acceptance example: select a stream, start its dev environment, open the correct preview, leave the stream, return within the same app run, and find the same running environment. Starting another stream must not silently reuse the wrong port, simulator, or code.

The product should make this easy without concealing useful error messages or logs when setup fails.

### 6. Use a terminal without an agent

An ordinary shell must be immediately accessible from the selected stream. A **Terminal** tab is the current interaction hypothesis. It is separate from displaying an agent's terminal interface.

Acceptance example: open a stream, run a command in its working folder, switch away, and return to the same shell and output without creating a coding session.

First-version assumption: shells and dev processes are owned by the app process and end when the app quits. Scrollback is persisted so the overview can show what last happened. Surviving app restarts would need a separate daemon, which the first version does not have.

Open decisions: multiple terminal tabs and whether the internal model unifies shells and agent sessions.

### 7. Coordinate agent sessions

Support several sessions per stream and different coding tools. New sessions inherit the task brief, relevant decisions, and the stream's environment. Keep each session's original identity and history attached.

Show working, waiting for input, idle, interrupted, failed, or unknown when those states are observable. A finished turn is not proof that the stream is done. Structured provider APIs such as Codex App Server give real turn and approval states; a terminal widget alone does not.

Provider session identity lives outside the app (for example, Codex threads in the Codex home directory, Claude Code sessions keyed by working directory). Moving or retiring a worktree can break resume. Record enough to detect this and offer recovery rather than assuming resume works.

Acceptance example: Claude implements a change and Codex reviews it in the same working folder, one after the other. Both sessions remain attached to the stream, and the overview explains their results without the user opening both conversations.

Observation, sending follow-ups, interrupting, and resuming need validation per provider.

### 8. Maintain context with the companion

At stream scope, ask "What should I do now?" and get an answer grounded in that stream, its descendants, and its ancestors' intent and decisions. The conversation is isolated to the stream but can see its sessions, environment, issues, pull requests, decisions, and events. It may coordinate work, but orchestration is not required for every use.

The companion operates the app only through the action interface, so its actions appear in the same history as human actions.

Acceptance example: "This PR merged and has no monitor. Add one" creates and attaches the monitor and reports the result.

Implementation direction: the Rust core calls a model API directly with a small tool set backed by the action interface. Provider choice is a thin abstraction; the first model is whatever is most convenient. The web interface never holds credentials or calls providers. The companion is added after the first slice works; a proof of concept during the slice is optional.

An app-wide companion is deferred. Its eventual purpose is meta-level guidance across projects and streams, such as answering "What should I work on now?"

### 9. Follow changes through delivery

Keep PR checks, review, merge, deployment, and outcome verification distinct. A stream can span multiple PRs and deployments.

Acceptance example: a merge event attaches a monitor, the monitor waits for the matching production deployment, and its result updates the stream. A quiet error dashboard without traffic or an exercised flow should not be described as a verified fix.

Monitoring scope, evidence requirements, observation windows, and how regressions reopen work remain to be defined. Monitors are outside the first slice.

### 10. Trigger work through hooks

The first version keeps actions human-initiated, with PR sync as the one deterministic exception. Every meaningful action is defined once, in the action interface, and logged with its actor, so the companion and external triggers can call it later.

Later event-driven examples:

- GitHub PR merged → find the stream → attach a monitor → wait for deployment → observe → update the stream.
- Linear issue assigned → create or locate the linked stream.
- Agent turn finished → record the outcome and refresh readiness.
- Repeated delivery of the same event → reuse the existing result, without duplicate work.
- Failed action → expose the failure and allow an appropriate retry.

Nothing needs to run while the Mac is asleep or offline in the first version. Cloud execution and delivery of events to an unavailable Mac are future concerns.

### 11. Retire working environments without losing history

Streams, decisions, events, and delivery evidence outlive their working folders. Provide visibility into stale environments and an explicit way to retire or retain them.

An environment with uncommitted work, unpushed commits, or running processes needs special handling. Exact cleanup policy is undecided. Nothing removes a real worktree without an explicit user action.

Acceptance example: retire a clean, inactive environment while preserving its stream and sessions; return later and recreate a worktree from the recorded branch.

## What the wireframe explores

The wireframe in this folder predates several decisions above. It still says task, workstream, and workspace where this spec says stream, and it shows a workspace-scoped companion that is now deferred. It remains useful for the interaction shapes:

- A project selector with an all-project option.
- One stream tree, grouped by project or ordered by readiness.
- One top-level creation button and a sample issue-prefill flow.
- A working-environment card on the overview and a dedicated shell tab.
- Creating an environment only when needed.
- Web preview and simulator entry points represented by local mock screens.
- Recovery, session, PR, hook, and monitoring flows.

Everything is simulated. None of these interactions create worktrees, run commands, fetch issues, or contact services.

## Technical direction

Build v2 as one Tauri 2 macOS application in a new repository. Use React and TypeScript for the interface, Rust for all privileged behavior, SQLite for durable local state, and Tauri commands, events, and channels between the interface and Rust.

Rust is chosen because it is the language wanted for this application. Electron with a Node backend would let the current TypeScript code be reused and is the alternative if that preference ever changes. That trade is accepted: v2 rewrites the Codex App Server client, worktree management, GitHub sync, and SQLite layer in Rust, using the v1 implementations as reference for edge cases.

This means one installed `.app`, not a local website plus a separately managed server. Agent runtimes such as Codex App Server run as supervised child processes and communicate with the Rust core over standard input and output. The first version does not expose an HTTP or WebSocket server on localhost.

The Rust core owns:

- SQLite data and migrations.
- Projects, worktrees, branches, and git operations (shelling out to `git` is acceptable and matches how worktrees are most reliably managed).
- Terminals, PTYs, dev processes, and their lifecycle.
- Agent subprocesses and provider-specific adapters.
- PR sync and readiness rules.
- The companion's model calls and tools.
- Credentials, notifications, and other native capabilities.
- The action interface and its log.

The web interface owns presentation, navigation, editing state, and rendering of streamed events. It has no filesystem, process, or network access of its own.

Known platform details to handle from the start:

- GUI applications on macOS do not inherit the shell's PATH. Resolve `git`, `gh`, `codex`, and similar tools through a login shell or explicit configuration.
- PTY output and token streams are high-volume. Use Tauri channels for them, not per-message events.
- Use the user's installed agent binaries rather than bundling them, so releases are not coupled.
- Code signing and notarization are needed before the app is shared with anyone else.

A starting repository layout:

```text
apps/desktop/
  src/                 React and TypeScript interface
  src-tauri/           Tauri entry point, commands, and macOS packaging
crates/core/           application services, domain types, actions, readiness rules
crates/persistence/    SQLite implementation
crates/providers/      Codex and later agent adapters
```

Do not split crates merely to match this diagram. Start with the desktop app and extract a crate when a boundary becomes useful. Tauri command handlers stay thin so the underlying operations can later be called through another transport.

### Relevant precedents

- [Codex](https://openai.com/index/unlocking-the-codex-harness/) uses an Electron desktop interface with a pinned Rust Codex App Server child process, communicating over JSON-RPC on standard input and output. OpenAI publishes the [CLI, SDK, and App Server](https://learn.chatgpt.com/docs/open-source), but not the desktop interface. MergeTray reuses the App Server boundary instead of recreating Codex session semantics.
- [T3 Code](https://github.com/pingdotgg/t3code/blob/main/docs/internals/overview.md) uses Electron and React with a Node server that owns SQLite, terminals, Git, files, and provider processes. Its rule that execution stays with the workspace is useful. Its event-sourced command and projection system is more machinery than v2 needs; the action log here is the lightweight equivalent.
- [OpenClaw](https://github.com/openclaw/openclaw/blob/main/docs/concepts/architecture.md) uses a native Swift shell with a long-lived Node Gateway that remote clients reach over WebSocket. A useful future reference for remote access, not a day-one template.
- [OpenCovibe](https://github.com/AnyiWang/OpenCovibe) uses Tauri 2 with a Rust backend, terminals, and coding-agent subprocesses including Codex App Server. It is evidence that this stack works for the same class of application.

### Path to phone and cloud access

Future remote access should not force a local client-server design today. Keep domain operations independent of Tauri, use stable identifiers, and represent changes as serializable events and actions. That leaves room to expose the same Rust operations through an authenticated network transport later.

Do not build a gateway, authentication, synchronization, or conflict model until a second device must perform a concrete workflow.

## First end-to-end slice

The smallest useful workflow is:

1. Register a project from an existing local clone.
2. Start a stream from a GitHub issue.
3. Start a Codex session in that stream and ask it to fix the issue and open a pull request. The worktree is created at this point.
4. Keep the pull request attached to the stream and refresh it until it merges.
5. Quit the app, come back the next day, select the stream, and understand its state and next action from the overview alone.

Step 5 is the central product test and is part of the slice. Without it the slice only proves plumbing.

The slice is human-initiated throughout. It does not require hooks, the companion, monitors, synthetic PR streams, remote access, or a second agent provider. Those follow once this loop is useful in daily work. The suggested order after the slice is: synthetic PR streams and snoozing (replacing the v1 inbox), then the stream companion, then monitors.

## Actions in the first slice

The action interface is defined from the start, with every invocation logged with actor, arguments, and outcome:

- Register project.
- Create stream (freeform, from issue, or as child).
- Set attention state.
- Ensure environment.
- Start session, send follow-up, interrupt session.
- Attach PR, refresh PR.
- Raise decision, resolve decision.
- Retire environment, recreate environment.

## Remaining decisions

1. Confirm GitHub issues as the first tracker and Codex App Server as the first agent provider. Both are proposed above.
2. The smallest agent integration contract for the first provider: which App Server messages the app needs for status, approval, follow-up, interrupt, and resume.
3. How the project dev recipe is expressed and how ports and simulators are assigned per environment.
4. Whether a bare clone per project should replace the registered user clone as the worktree base.
5. How sessions raise decisions, per provider, and whether decisions can be raised from the terminal.
6. Multiple terminal tabs and whether shells and agent sessions share one internal model.
7. Which model the companion uses first, and its autonomy boundaries.

The desktop shell, core runtime, persistence, local execution boundary, data model, readiness approach, and first workflow are chosen. The remaining answers determine the agent protocol, environment recipes, and integration work rather than reopening the architecture without new evidence.
