# MergeTray: a home for ongoing work

Working product spec · September 24, 2026

This records the direction agreed in the conversation, the interactions being explored in the wireframe, and the questions still open. It is not an implementation plan or a choice of technology. The prototype is disposable; its data model and shortcuts are not production requirements.

## The problem

Several projects are active at once. Ideas, discussions, coding sessions, terminals, dev environments, issues, and pull requests live in different places. Returning to a piece of work requires searching those places to reconstruct what happened and what to do next.

MergeTray should preserve that context and provide a useful place to continue. Work may happen in other applications; it must remain understandable here.

### The central product test

With several streams underway, can I select any one of them and understand where I am and what to do next, without searching another platform?

The test should hold after an hour away, a week away, or a month away. It should also hold for an idea that has never produced code.

## Settled direction

- The organizing unit is the work being pursued. A pull request is one artifact of that work.
- Use **streams** in the interface. Streams may contain other streams recursively. A bug and a large effort use the same underlying concept.
- Projects provide a higher-level grouping for separate products or repositories. The exact name and repository relationship are still open.
- Keep both project-specific views and an all-project view ordered by what is ready or needs attention.
- Target a macOS application. The current web interface simulates that application.
- Include an app-wide companion that can act on the workspace and help maintain context. A stream-scoped conversation must also be available.
- Support different coding agents. Terminal-first integration and reuse of an existing coding UI remain viable options.
- Make application actions callable by humans, agents, hooks, and external events.
- Give each active stream clear access to its working folder, terminal, and development environment.
- Keep creation simple: one plus button beside **Streams**, with the ability to fill out a stream from a linked external issue.

## Concepts and their purpose

| Concept | Purpose | Relationships |
| --- | --- | --- |
| Project | Keep a product or independent body of work separate; hold useful defaults | Contains streams; associated repositories and environment defaults need definition |
| Stream | Preserve intent, context, decisions, current state, and next action | May contain streams, sessions, issue links, PRs, monitors, and a working environment |
| Working environment | Identify where files, processes, and execution belong | Can be associated with a stream; sharing and isolation between descendants are open |
| Agent session | Perform a particular attempt at research, implementation, or review | Attached to a stream and an explicit working environment when code is involved |
| Terminal | Run ordinary commands in the correct working folder | Available without starting a coding agent; attached to an environment |
| Dev environment | Run and inspect the thing being built | Has a lifecycle and an appropriate entry point, such as a browser preview or simulator |
| Pull request | Review and integrate a code change | One stream can have several, with independent checks, review, and merge states |
| Monitor | Collect evidence after deployment | Attached to the relevant change and stream; distinguishes observation from verification |
| Companion conversation | Recover context, decide next steps, and operate the app | Scoped to a stream or the broader workspace; underlying agent topology is undecided |
| Hook | Turn an external or internal event into an action | Uses the same action interface as the UI and companion |

Streams form a containment tree. Dependencies and shared artifacts may require additional links. Avoid duplicating a single PR or deployment merely because it contributes to more than one stream. Detailed cardinalities belong in the technical discussion.

## Feature goals and acceptance examples

### 1. Recover and continue work

The stream overview explains the intent, last meaningful result, ongoing work, unresolved decisions, and next useful action. It also links to supporting evidence and the right place to continue.

The overview must be useful before opening any links. A page of bookmarks or a combined transcript does not satisfy the central test.

Acceptance example: open checkout after a month and learn that three coding sessions ran, one PR merged and was verified, another PR is waiting for review, and the next action is inspecting that preview.

Summaries should carry an update time and retain their supporting sources. If a source is stale or unavailable, the companion should distinguish what it last knew from what it has checked now.

### 2. Organize projects and recursive streams

- Work within one project or see all projects together.
- Group streams by project when navigating by subject.
- View streams across projects by readiness, needed input, or ongoing work.
- Expand descendants without losing the parent context.
- Show useful counts and exceptions at parents, including deeply nested work.
- Allow a parent to have its own conversations, sessions, and artifacts.

Acceptance example: a parent with many descendants identifies the two decisions that need attention, the session still running, and the change still being monitored. A single green child does not imply the parent is complete.

The project selector and grouping controls are views of the same work. Switching views must not duplicate or relocate it. Avoid a growing list of separate navigation destinations for every project and state.

### 3. Capture or import a stream

The plus beside **Streams** opens one creation flow. Start with a freeform idea or reference a Linear issue, GitHub issue, or another supported source.

When a source is resolved, populate the available title, description, source link, and project/repository information. Show the result before creation and allow edits. A companion may help interpret or enrich it, but imported source facts should remain attributable.

Acceptance examples:

- Paste a Linear issue and get an editable populated form.
- Paste a GitHub issue from another project and see the suggested project.
- Create an idea with no repository, issue, or working folder.
- Create a child stream in the existing project.
- Encounter an inaccessible issue without having invented details filled in.
- Import an already-linked issue and be offered the existing stream.

Source synchronization, write-back, and handling conflicting edits remain open.

### 4. Associate work with a working folder

The user should not have to remember which checkout belongs to which stream. Agents, terminals, and dev processes should open in the environment associated with the selected stream.

The overview should expose enough context to prevent mistakes: environment state, relevant repository/branch, whether it is shared with another stream, and a way to inspect or change the association.

**Current hypothesis, not a decision:** prepare an isolated worktree when executable work first needs one. Pure ideas need no folder. A project may provide a base checkout; child streams may share a parent environment until independent work needs isolation.

Acceptance examples:

- Start a session from an idea; choose or establish the working environment before coding begins.
- Open the terminal from that stream and land in the same working folder.
- Return later and reconnect to the existing environment.
- See when a child is sharing its parent’s environment, with a path to separate it.
- Detect a missing folder instead of silently switching to an unrelated checkout.

Open decisions: eager versus lazy creation, worktrees versus ordinary checkouts, multi-repository work, sharing between sessions and children, base-branch selection, and remote execution.

### 5. Run and reopen development environments

Expose the associated dev environment directly on the overview and from the terminal. Show whether it is absent, preparing, running, stopped, or failed. Provide its entry point when usable.

For a web project, the entry point can be a local preview. For a mobile project, it can open the relevant simulator. Other project types may have different launch or inspection actions.

Acceptance example: select a stream, start its dev environment, open the correct preview, leave the stream, return, and find the same running environment. Starting another stream must not silently reuse the wrong port, simulator, or code.

The product should make this easy without concealing useful error messages or logs when setup fails. Exact discovery, startup recipes, port allocation, and simulator control are technical questions.

### 6. Use a terminal without an agent

An ordinary shell must be immediately accessible from the selected stream. A **Terminal** tab is the current interaction hypothesis. It is separate from displaying an agent’s terminal interface.

Acceptance example: open a stream, run a command in its working folder, switch away, and return to the same shell and output without creating a coding session.

Open decisions: multiple terminal tabs, persistence across app restarts, background process ownership, and whether the internal model unifies shells and agent sessions.

### 7. Coordinate agent sessions

Support several sessions per stream and different coding tools. New sessions inherit the task brief, relevant decisions, and correct environment. Keep each session’s original identity and history attached.

Show working, waiting for input, idle, interrupted, failed, or unknown when those states are observable. A finished turn is not proof that the stream is done. Hooks and structured provider APIs are integration candidates; a terminal widget alone does not establish semantic status.

Acceptance example: Claude implements a change, Codex reviews it, and both remain attached to the same stream. The companion can explain their results without the user opening both conversations.

Observation, sending follow-ups, interrupting, and resuming need validation per provider. T3 Code reuse, a component library, and embedded terminals remain options rather than decisions.

### 8. Maintain context with the companion

At stream scope, ask “What should I do now?” and get an answer grounded in that stream and its descendants. At workspace scope, ask what needs attention across projects or request an action such as importing an issue or finding an unmonitored merge.

The companion should be able to operate all meaningful application actions, including navigation and view changes. Its actions should appear in the same history as equivalent human actions.

Acceptance example: “This PR merged and has no monitor. Add one” creates and attaches the monitor and reports the result.

**Open:** one agent with scoped context versus separate per-stream agents; model choice; invocation triggers; background behavior; and autonomy boundaries. A continuously available experience need not imply continuous model inference. The wireframe’s separate conversations do not settle the agent architecture.

### 9. Follow changes through delivery

Keep PR checks, review, merge, deployment, and outcome verification distinct. A stream can span multiple PRs and deployments.

Acceptance example: a merge event attaches a monitor, the monitor waits for the matching production deployment, and its result updates the stream. A quiet error dashboard without traffic or an exercised flow should not be described as a verified fix.

Monitoring scope, evidence requirements, observation windows, and how regressions reopen work remain to be defined.

### 10. Trigger work through hooks

Any meaningful action available through the UI should also be callable by the companion and external triggers. Examples include creating streams, launching sessions, attaching artifacts, starting monitors, and updating state.

Acceptance examples:

- GitHub PR merged → find the stream → attach a monitor → wait for deployment → observe → update the stream.
- Linear issue assigned → create or locate the linked stream.
- Agent turn finished → record the outcome and refresh context.
- Repeated delivery of the same event → reuse the existing result, without duplicate work.
- Failed action → expose the failure and allow an appropriate retry.

Record the initiating event, resulting action, and outcome. The desktop’s receipt of events while disconnected or asleep requires a deliberate design; it is not solved by drawing a webhook toggle.

### 11. Retire working environments without losing history

Streams, decisions, and delivery evidence should outlive their working folders. Provide visibility into stale environments and an explicit way to clean them up or retain them.

An environment with unsaved/uncommitted work, unpushed commits, running processes, or another active stream depending on it needs special handling. Exact cleanup policy is undecided. The prototype must not be interpreted as approval for automatic deletion of real worktrees.

Acceptance example: retire a clean, inactive environment while preserving its stream and sessions; return later and recreate a working environment from recorded repository state.

## What the revised wireframe explores

- A project selector with an all-project option.
- One stream tree, grouped by project or ordered by readiness.
- One top-level creation button and a sample issue-prefill flow.
- A working-environment card on the overview and a dedicated shell tab.
- Creating an environment only when needed, with visible parent sharing.
- Web preview and simulator entry points represented by local mock screens.
- Existing recovery, session, PR, hook, and monitoring flows.

Everything is simulated. Folder paths, issue resolution, commands, previews, and model responses are examples. Refreshing resets browser memory. None of these interactions create worktrees, run commands, fetch issues, or contact services.

## Decisions to discuss before technology selection

1. Does a project represent a product, one repository, or a collection of repositories?
2. At which point is an environment created, and what is the default isolation boundary?
3. How do children and concurrent sessions share or separate working folders?
4. Who owns dev processes and terminals when windows close or the app restarts?
5. What should continue when the Mac is asleep or offline?
6. Are companion conversations independent agents, or views onto one coordinating agent?
7. Which integration capabilities must every agent support, and which can be optional?
8. Which actions should run automatically from events, and where is human judgment required?
9. What is the smallest real project-to-stream-to-delivery flow that would replace the current daily workflow?

Only then choose the desktop shell, runtime, persistence model, agent protocols, event transport, UI reuse strategy, and packaging. These choices should support the agreed workflow rather than determine it.
