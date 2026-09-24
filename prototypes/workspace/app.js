const paths = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14 M5 12h14",
  chevron: "M9 5l7 7-7 7",
  down: "M5 9l7 7 7-7",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  spark: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  layers: "M12 3L2 8l10 5 10-5z M2 12l10 5 10-5 M2 16l10 5 10-5",
  branch: "M6 3v12a6 6 0 0 0 6 6 M6 9h6a6 6 0 0 0 6-6 M4 3h4 M16 3h4 M10 21h4",
  pr: "M6 8v10 M4 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M4 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M18 18V9a4 4 0 0 0-4-4h-2 M15 2l-3 3 3 3 M16 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  check: "M5 12l4 4L19 6",
  circle: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  activity: "M2 12h5l3-8 4 16 3-8h5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  terminal: "M3 4h18v16H3z M7 8l4 4-4 4 M13 16h4",
  chat: "M4 4h16v12H9l-5 4z",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  bolt: "M13 2L4 14h7l-1 8 10-13h-7z",
  gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  close: "M6 6l12 12 M6 18L18 6",
  panel: "M3 4h18v16H3z M15 4v16",
  folder: "M3 6h7l2 3h9v11H3z",
  send: "M12 19V5 M6 11l6-6 6 6",
  file: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6",
  monitor: "M3 4h18v13H3z M12 17v4 M8 21h8",
  stop: "M6 6h12v12H6z",
  play: "M7 4l14 8-14 8z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  idea: "M8 16c-6-5-2-13 4-13s10 8 4 13v3H8z M9 22h6",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.circle}"/></svg>`;
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const statusNames = {
  review: "Needs review",
  working: "In progress",
  done: "Complete",
  idea: "Idea",
  blocked: "Needs a decision",
};
const pill = (status, text) =>
  `<span class="pill ${status}">${icon(status === "done" ? "check" : "circle")}${esc(text || statusNames[status] || status)}</span>`;
const button = (label, action, glyph, cls = "") =>
  `<button class="btn ${cls}" data-action="${action}">${glyph ? icon(glyph) : ""}${label}</button>`;

const tasks = [
  {
    id: "checkout",
    parent: null,
    title: "A smoother checkout",
    status: "review",
    repo: "coastline / next",
    issue: "COA-248",
    age: "18 days",
    description:
      "Make it easier for new students to choose a package and finish booking. Preserve the decisions and evidence across the checkout changes.",
    summary:
      "You settled on keeping package selection on one page. The payment recovery fix shipped and passed its monitor. Package comparison is implemented in PR #6842; the preview is ready for your review. No coding session is currently running.",
    next: "Review the package comparison preview, then merge PR #6842.",
    decision:
      "Keep the existing payment provider. Show the total price before asking students to create an account.",
  },
  {
    id: "packages",
    parent: "checkout",
    title: "Compare lesson packages",
    status: "review",
    repo: "coastline / next",
    issue: "COA-251",
    age: "18 days",
    description:
      "Let students compare package lengths and total prices without leaving checkout. Highlight the recommended package without hiding alternatives.",
    summary:
      "Claude implemented the comparison cards. Codex reviewed the change and fixed a keyboard navigation issue. All checks on PR #6842 pass. You paused before reviewing the desktop and mobile previews.",
    next: "Open the preview and decide if the comparison is clear enough to ship.",
    decision:
      "Use total prices, not per-hour prices. Keep the recommendation subtle.",
  },
  {
    id: "keyboard",
    parent: "packages",
    title: "Keyboard navigation",
    status: "done",
    repo: "coastline / next",
    issue: "COA-256",
    age: "19 days",
    description: "Make package selection usable without a mouse.",
    summary:
      "Codex fixed focus order and added arrow-key navigation to package selection. The changes are included in PR #6842 and the focused checks passed.",
    next: "This task is complete. Its changes will ship with package comparison.",
    decision: "Use the standard radio-group keyboard behavior.",
  },
  {
    id: "payments",
    parent: "checkout",
    title: "Recover interrupted payments",
    status: "done",
    repo: "coastline / next",
    issue: "COA-249",
    age: "21 days",
    description:
      "Let students resume checkout after a payment interruption without starting over.",
    summary:
      "PR #6831 merged and deployed. The 30-minute production monitor saw successful checkout recovery and no related errors. You marked this task complete.",
    next: "No action needed. The deployment and monitoring evidence are attached.",
    decision: "Reuse the original payment intent when it is still valid.",
  },
  {
    id: "instructors",
    parent: null,
    title: "Instructor availability",
    status: "working",
    repo: "coastline / next",
    issue: "COA-267",
    age: "2 hours",
    description:
      "Make the availability calendar easier for instructors to maintain and easier for operations to audit.",
    summary:
      "The weekly calendar implementation is underway in a Codex session. Conflict detection is blocked on your decision about overlapping availability. The Slack discussion is linked below.",
    next: "Decide whether overlapping availability should warn or block saving.",
    decision: "Use the instructor’s local time zone throughout the calendar.",
  },
  {
    id: "calendar",
    parent: "instructors",
    title: "Weekly calendar",
    status: "working",
    repo: "coastline / next",
    issue: "COA-268",
    age: "2 hours",
    description: "Build the weekly view and a reusable availability editor.",
    summary:
      "Codex is implementing the week view. The grid and time-zone handling are finished; it is working on editing recurring availability.",
    next: "Let the implementation finish, or open the session to steer it.",
    decision: "Start the week on Monday and display the current time zone.",
  },
  {
    id: "conflicts",
    parent: "instructors",
    title: "Handle schedule conflicts",
    status: "blocked",
    repo: "coastline / next",
    issue: "COA-269",
    age: "3 hours",
    description:
      "Explain overlapping availability before instructors save their schedule.",
    summary:
      "The implementation is waiting on a product decision. Operations prefers a warning for overlapping availability; the original issue requested a hard block.",
    next: "Choose whether to warn or block when availability overlaps.",
    decision: "Unresolved: warn on overlap or prevent saving.",
  },
  {
    id: "coast",
    parent: null,
    title: "Coast.ai, next chapter",
    status: "idea",
    repo: "coastline / coast.ai",
    issue: null,
    age: "1 month",
    description:
      "Explore how to explain the company and technology behind Coastline, with examples of the real operational work.",
    summary:
      "You explored five landing-page directions and favored the quieter editorial treatment. You wanted to ground the story in traffic prediction and operational audits. No implementation has started.",
    next: "Choose one direction and turn it into a small first-page task.",
    decision:
      "Speak about the company behind Coastline. Avoid unsupported AI claims.",
  },
  {
    id: "story",
    parent: "coast",
    title: "Find the company story",
    status: "idea",
    repo: "coastline / coast.ai",
    issue: null,
    age: "1 month",
    description:
      "Find concrete examples that explain what Coast.ai builds and operates.",
    summary:
      "Your last conversation identified traffic prediction and schedule auditing as useful examples. The next step is choosing one example to lead the page.",
    next: "Pick the first operational example to feature.",
    decision:
      "Lead with work people can recognize, rather than broad technology promises.",
  },
];
const sessions = [
  {
    id: "s1",
    task: "packages",
    title: "Build package comparison",
    provider: "Claude Code",
    state: "idle",
    summary: "Built the cards, total-price display, and mobile layout.",
    time: "Sep 6 · 42 min",
    messages: [],
  },
  {
    id: "s2",
    task: "packages",
    title: "Review accessibility and edge cases",
    provider: "Codex",
    state: "idle",
    summary: "Fixed keyboard focus. Checked selection state across navigation.",
    time: "Sep 6 · 18 min",
    messages: [],
  },
  {
    id: "s3",
    task: "payments",
    title: "Recover an interrupted payment",
    provider: "Codex",
    state: "idle",
    summary: "Reused pending payment intents and verified recovery.",
    time: "Sep 3 · 31 min",
    messages: [],
  },
  {
    id: "s4",
    task: "calendar",
    title: "Implement the weekly calendar",
    provider: "Codex",
    state: "working",
    summary: "Week grid is ready. Implementing recurring availability edits.",
    time: "Today · 24 min",
    messages: [],
  },
];
const prs = [
  {
    id: 6842,
    task: "packages",
    title: "Add lesson package comparison",
    state: "review",
    add: 184,
    remove: 46,
    branch: "matt/package-comparison",
  },
  {
    id: 6831,
    task: "payments",
    title: "Resume interrupted checkout payments",
    state: "done",
    add: 67,
    remove: 19,
    branch: "matt/payment-recovery",
  },
];
const monitors = [
  {
    id: "m1",
    task: "payments",
    pr: 6831,
    state: "done",
    title: "Checkout recovery · production",
  },
];
const events = [
  {
    task: "calendar",
    icon: "terminal",
    title: "Codex started implementing recurring availability",
    detail: "The week grid and time-zone handling are ready.",
    time: "24 minutes ago",
  },
  {
    task: "conflicts",
    icon: "chat",
    title: "A decision is needed on schedule conflicts",
    detail: "Operations suggested a warning instead of blocking the save.",
    time: "2 hours ago",
  },
  {
    task: "packages",
    icon: "check",
    title: "All checks passed on PR #6842",
    detail: "Build, type checks, and keyboard navigation checks passed.",
    time: "Sep 6 · 3:24 PM",
  },
  {
    task: "packages",
    icon: "terminal",
    title: "Codex finished the accessibility review",
    detail: "Fixed focus order. No remaining review findings.",
    time: "Sep 6 · 3:12 PM",
  },
  {
    task: "payments",
    icon: "activity",
    title: "Production monitor completed",
    detail:
      "Recovery flow verified. No related errors during the observation window.",
    time: "Sep 3 · 4:30 PM",
  },
  {
    task: "payments",
    icon: "pr",
    title: "PR #6831 merged and deployed",
    detail: "A monitor was attached automatically by the PR merged hook.",
    time: "Sep 3 · 4:00 PM",
  },
  {
    task: "checkout",
    icon: "chat",
    title: "You chose to keep package selection on one page",
    detail: "Show total prices before account creation.",
    time: "Sep 2 · 10:15 AM",
  },
];
const hooks = [
  {
    id: "merge",
    name: "Follow every merge into production",
    source: "GitHub · pull_request.merged",
    result: "Attach a deployment monitor",
    on: true,
  },
  {
    id: "session",
    name: "Keep task context up to date",
    source: "Agent · turn.completed",
    result: "Refresh the task brief",
    on: true,
  },
  {
    id: "linear",
    name: "Bring assigned issues into the workspace",
    source: "Linear · issue.assigned",
    result: "Create a task in Incoming",
    on: false,
  },
];
const executions = [
  {
    title: "PR #6831 → monitor attached to Recover interrupted payments",
    time: "Sep 3",
    state: "done",
  },
];
const state = {
  view: "home",
  task: "checkout",
  tab: "overview",
  companion: innerWidth > 980,
  scope: "task",
  expanded: new Set(["checkout", "packages", "instructors", "coast"]),
  conversations: {},
  dev: false,
  filter: "all",
  session: null,
  sessionMode: "chat",
};
const $ = (sel) => document.querySelector(sel);
const current = () => tasks.find((t) => t.id === state.task);
const children = (id) => tasks.filter((t) => t.parent === id);
function descendants(id) {
  return [id, ...children(id).flatMap((t) => descendants(t.id))];
}
const taskSessions = (id) =>
  sessions.filter((s) => descendants(id).includes(s.task));
const taskPRs = (id) => prs.filter((p) => descendants(id).includes(p.task));
const taskMonitors = (id) =>
  monitors.filter((m) => descendants(id).includes(m.task));
const contextKey = () =>
  state.scope === "workspace" || state.view !== "task"
    ? "workspace"
    : state.task;
function notify(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function event(task, title, detail, glyph = "spark") {
  events.unshift({ task, title, detail, icon: glyph, time: "Just now" });
}
function openTask(id, tab = "overview") {
  state.task = id;
  state.view = "task";
  state.tab = tab;
  state.scope = "task";
  let t = tasks.find((t) => t.id === id);
  while (t?.parent) {
    state.expanded.add(t.parent);
    t = tasks.find((x) => x.id === t.parent);
  }
  render();
}
function tree(id = null, depth = 0) {
  return children(id)
    .map((t) => {
      const kids = children(t.id);
      return `<div class="tree-row ${state.view === "task" && state.task === t.id ? "selected" : ""}" style="padding-left:${depth * 13 + 3}px">${kids.length ? `<button class="expander" data-expand="${t.id}" aria-label="${state.expanded.has(t.id) ? "Collapse" : "Expand"} ${esc(t.title)}" aria-expanded="${state.expanded.has(t.id)}">${icon(state.expanded.has(t.id) ? "down" : "chevron")}</button>` : '<span class="expander"></span>'}<button class="task-name" data-task="${t.id}"><span class="marker ${t.status}"></span><span>${esc(t.title)}</span></button></div>${kids.length && state.expanded.has(t.id) ? tree(t.id, depth + 1) : ""}`;
    })
    .join("");
}
function render() {
  $("#app").innerHTML =
    `<div class="app-shell"><header class="titlebar"><div class="traffic" aria-hidden="true"><i></i><i></i><i></i></div><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation">${icon("menu")}</button><button class="icon-button" data-action="home" aria-label="Go to home">${icon("home")}</button><span class="title">MergeTray <span style="color:#b8bdc5;padding:0 7px">/</span> Harvey’s workspace</span><div class="title-actions"><button class="icon-button" data-action="search" aria-label="Search workspace">${icon("search")}</button><button class="icon-button" data-action="toggle-companion" aria-label="Toggle companion">${icon("panel")}</button></div></header><aside class="sidebar"><div class="brand"><span class="brand-mark">${icon("branch")}</span>MergeTray<small>LAB</small></div><button class="nav ${state.view === "home" ? "active" : ""}" data-action="home">${icon("home")} Home</button><button class="nav" data-action="search">${icon("search")} Search <span class="shortcut">⌘ K</span></button><button class="nav ${state.view === "attention" ? "active" : ""}" data-action="attention">${icon("circle")} Needs you <span class="count">${tasks.filter((t) => ["review", "blocked"].includes(t.status) && t.parent).length}</span></button><button class="nav ${state.view === "activity" ? "active" : ""}" data-action="activity">${icon("activity")} Activity</button><div class="section-label">Workstreams<button class="icon-button" data-action="new" aria-label="New workstream">${icon("plus")}</button></div>${tree()}<button class="nav" style="margin-top:14px;color:#9298a4" data-action="new">${icon("plus")} Capture an idea</button><div class="sidebar-bottom"><button class="nav ${state.view === "hooks" ? "active" : ""}" data-action="hooks">${icon("bolt")} Hooks & automations</button><button class="nav ${state.view === "settings" ? "active" : ""}" data-action="settings">${icon("gear")} Workspace settings</button><div class="profile"><span class="avatar">H</span><div>Harvey<small>Personal workspace</small></div></div></div></aside><div class="main-region"><main class="main" id="main">${mainView()}</main><aside class="companion ${state.companion ? "" : "hidden"}" aria-label="Workspace companion">${companionView()}</aside></div><footer class="statusbar"><div class="left"><span class="dot"></span>Local workspace<span style="padding:0 4px;color:#c6cad1">|</span><span>Prototype · sample data</span></div><div class="right">${icon("terminal")}<button data-action="dev">${state.dev ? "Dev preview running" : "Dev preview stopped"}</button><span style="padding:0 4px;color:#c6cad1">|</span><button data-action="reset">Reset demo</button></div></footer></div>`;
  const chat = $(".companion-body");
  if (chat) chat.scrollTop = chat.scrollHeight;
}
function mainView() {
  if (state.view === "task") return taskView();
  if (state.view === "hooks") return hooksView();
  if (state.view === "settings") return settingsView();
  if (state.view === "activity")
    return `<div class="content"><div class="page-heading"><div><div class="eyebrow">Across your workspace</div><h1>Activity</h1><p>The work keeps moving. Here’s what changed.</p></div></div>${timeline(events)}</div>`;
  if (state.view === "attention")
    return `<div class="content"><div class="page-heading"><div><div class="eyebrow">Your next moves</div><h1>Needs you</h1><p>Decisions and reviews that move the work forward.</p></div></div>${attention()}<div class="note">Everything else can keep moving. These are the places where your input makes a difference.</div></div>`;
  return homeView();
}
function attention() {
  const items = tasks.filter(
    (t) => t.parent && ["review", "blocked"].includes(t.status),
  );
  return items.length
    ? `<div class="attention-list">${items.map((t) => `<button class="attention-row" data-task="${t.id}"><span class="attention-icon ${t.status === "review" ? "" : "blue"}">${icon(t.status === "review" ? "pr" : "chat")}</span><div><strong>${esc(t.status === "review" ? "Review: " + t.title : t.title)}</strong><small>${esc(t.status === "review" ? (taskPRs(t.id).some((p) => p.state === "review") ? "Checks passed. The preview is ready." : "The completed session is ready to inspect.") : "A product decision is waiting for you.")}</small></div><span class="trailing">${esc(tasks.find((p) => p.id === t.parent).title)}${icon("chevron")}</span></button>`).join("")}</div>`
    : '<div class="empty">' +
        icon("check") +
        "<h3>You’re all caught up</h3><p>No decisions or reviews are waiting for you.</p></div>";
}
function homeView() {
  return `<div class="content"><div class="page-heading"><div><div class="eyebrow">Thursday, September 24</div><h1>A little context. A clear next step.</h1><p>${children(null).length} workstreams. One place to pick them back up.</p></div>${button("New task", "new", "plus")}</div><section class="resume-card"><div class="resume-top">${icon("clock")} PICK UP WHERE YOU LEFT OFF <span style="margin-left:auto;font-size:10px">18 days away</span></div><h2>A smoother checkout</h2><p>${esc(currentCheckoutBrief())}</p><div class="resume-bottom"><button class="btn primary" data-task="checkout">Continue this workstream ${icon("arrow")}</button><button class="btn quiet" data-action="catch-up-checkout">${icon("spark")} Catch me up</button></div></section><div class="block-heading"><h2>Needs your attention</h2><small>${tasks.filter((t) => t.parent && ["review", "blocked"].includes(t.status)).length} things to move forward</small></div>${attention()}<div class="block-heading"><h2>Your workstreams</h2><small>At your pace</small></div><div class="workspace-grid">${children(
    null,
  )
    .map((t, i) => {
      const desc = descendants(t.id)
        .slice(1)
        .map((id) => tasks.find((x) => x.id === id));
      const done = desc.filter((x) => x.status === "done").length;
      return `<button class="workspace-card" data-task="${t.id}"><div class="work-icon ${["blue", "orange", ""][i % 3]}">${icon(["layers", "clock", "idea"][i % 3])}</div><h3>${esc(t.title)}</h3><p>${esc(t.id === "checkout" ? "A clearer path from package to payment." : t.id === "instructors" ? "Better schedules, fewer surprises." : t.description)}</p><div class="progress-bar"><i style="width:${desc.length ? (done / desc.length) * 100 : 0}%"></i></div><div class="card-foot"><span>${done} of ${desc.length} subtasks complete</span><span>${esc(statusNames[t.status])}</span></div></button>`;
    })
    .join(
      "",
    )}</div><div class="block-heading"><h2>While you were away</h2><button class="btn quiet small" data-action="activity">All activity ${icon("arrow")}</button></div>${events
    .slice(0, 3)
    .map(
      (e) =>
        `<button class="activity-mini" style="width:100%;text-align:left" data-task="${e.task}">${icon(e.icon)}<span>${esc(e.title)}</span><time>${esc(e.time)}</time></button>`,
    )
    .join("")}</div>`;
}
function currentCheckoutBrief() {
  return prs[0].state === "done"
    ? "Both checkout PRs have merged. The package comparison monitor is attached; open the workstream to check its latest evidence."
    : "One fix shipped and passed monitoring. Package comparison is ready for review. Your next step is checking the preview, right where you left it.";
}
function taskView() {
  const t = current();
  const ancestors = [];
  let p = t;
  while (p.parent) {
    p = tasks.find((x) => x.id === p.parent);
    ancestors.unshift(p);
  }
  const tabs = [
    ["overview", "Overview", null],
    ["sessions", "Sessions", taskSessions(t.id).length],
    ["changes", "Pull requests", taskPRs(t.id).length],
    ["monitors", "Monitors", taskMonitors(t.id).length],
    ["activity", "Activity", null],
  ];
  return `<div class="breadcrumb"><button data-action="home">Workspace</button>${ancestors.map((p) => `${icon("chevron")}<button data-task="${p.id}">${esc(p.title)}</button>`).join("")}${icon("chevron")}<span>${esc(t.title)}</span></div><div class="content task-content"><div class="eyebrow">${t.parent ? "Task" : "Workstream"}</div><div class="task-heading"><h1>${esc(t.title)}</h1><div class="actions">${button("Add subtask", "new-child", "plus")}${button("Start session", "start-session", "terminal", "primary")}</div></div><div class="task-meta"><button data-action="status" style="padding:0">${pill(t.status)}</button><span>${esc(t.repo)}</span>${t.issue ? `<button data-action="source-linear" style="color:#8b929f;padding:0">${esc(t.issue)} ↗</button>` : ""}<span>Updated ${esc(t.age)} ago</span></div><nav class="tabs" aria-label="Task views">${tabs.map(([id, label, count]) => `<button class="tab ${state.tab === id ? "active" : ""}" data-tab="${id}" aria-current="${state.tab === id ? "page" : "false"}">${label}${count !== null ? `<span>${count}</span>` : ""}</button>`).join("")}</nav>${state.tab === "overview" ? overview(t) : state.tab === "sessions" ? sessionsView(t) : state.tab === "changes" ? changesView(t) : state.tab === "monitors" ? monitorsView(t) : timeline(events.filter((e) => descendants(t.id).includes(e.task)))}</div>`;
}
function overview(t) {
  return `<section class="brief"><div class="brief-title">${icon("spark")} Where you left off <small>Maintained by your companion</small></div><p>${esc(t.summary)}</p><div class="next-step"><div><label>Your next step</label><p>${esc(t.next)}</p></div>${button(t.status === "blocked" ? "Make a decision" : t.status === "review" ? "Review change" : "Talk it through", t.status === "blocked" ? "decision" : t.status === "review" ? "review-current" : "catch-up", "arrow", "small")}</div></section><div class="block-heading"><h2>The intent</h2>${button("Edit", "edit-task", null, "quiet small")}</div><p class="description">${esc(t.description)}</p>${
    children(t.id).length
      ? `<div class="block-heading"><h2>Tasks inside this</h2><small>${descendants(t.id).length - 1} across all levels</small></div><div class="rollup">${[
          "done",
          "working",
          "review",
          "blocked",
          "idea",
        ]
          .map((status) => {
            const count = descendants(t.id)
              .slice(1)
              .filter(
                (id) => tasks.find((x) => x.id === id).status === status,
              ).length;
            return count
              ? `<span>${count} ${status === "done" ? "complete" : status === "working" ? "in progress" : status === "review" ? "to review" : status === "blocked" ? "need a decision" : "ideas"}</span>`
              : "";
          })
          .join("")}</div><div class="task-list">${children(t.id)
          .map(
            (c) =>
              `<button class="task-list-row" data-task="${c.id}">${icon(children(c.id).length ? "layers" : "circle")}<span>${esc(c.title)}</span>${children(c.id).length ? `<small>${children(c.id).length} subtask</small>` : ""}${pill(c.status)}${icon("chevron")}</button>`,
          )
          .join("")}</div>`
      : ""
  }<div class="block-heading"><h2>Decisions to carry forward</h2></div><div class="note" style="margin-top:0">${esc(t.decision)}</div><div class="block-heading"><h2>Everything is connected</h2></div><div class="resource-grid"><button class="resource" data-action="source-linear">${icon("layers")}<div><strong>${t.issue ? `${esc(t.issue)} · Original issue` : "Working brief"}</strong><small>${t.issue ? "Linear · requirements and acceptance criteria" : "An idea can start here, before an issue exists"}</small></div></button><button class="resource" data-action="source-slack">${icon("chat")}<div><strong>${t.id === "coast" || t.id === "story" ? "Positioning conversation" : "Product discussion"}</strong><small>Slack · decisions and original context</small></div></button></div>`;
}
function sessionsView(t) {
  const list = taskSessions(t.id);
  return `<div class="block-heading" style="margin-top:0"><h2>Every attempt, in one place</h2>${button("Start session", "start-session", "plus", "small")}</div>${list.length ? list.map((s) => `<article class="session-card"><div class="session-top"><span class="provider">${s.provider === "Claude Code" ? "✳" : "C"}</span><div><h3>${esc(s.title)}</h3><small>${esc(s.provider)} · ${esc(tasks.find((t) => t.id === s.task).title)}</small></div>${pill(s.state === "working" ? "working" : "done", s.state === "working" ? "Working" : "Turn finished")}</div><p>${esc(s.summary)}</p><div class="session-actions"><span>${esc(s.time)}</span><button class="btn small" data-session="${s.id}">${icon("terminal")} Open session</button></div></article>`).join("") : empty("terminal", "Room for your first session", "Choose an agent when you’re ready to turn this idea into work.", button("Start a session", "start-session", "plus"))}<div class="banner">Sessions can use different agents. The task keeps the shared context and decisions.</div>`;
}
function changesView(t) {
  const list = taskPRs(t.id);
  return list.length
    ? list
        .map(
          (p) =>
            `<article class="session-card"><div class="session-top"><span class="provider">${icon("pr")}</span><div><h3>${esc(p.title)}</h3><small>#${p.id} · ${esc(p.branch)}</small></div>${pill(p.state, p.state === "done" ? "Merged" : "Ready for review")}</div><p><span style="color:#638d77">+${p.add}</span> <span style="color:#b28078">−${p.remove}</span> <span style="padding:0 8px;color:#c5cbd4">·</span> All checks passed <span style="padding:0 8px;color:#c5cbd4">·</span> ${p.state === "done" ? "Deployed to production" : "Preview available"}</p><div class="session-actions"><button class="btn quiet small" data-task="${p.task}">${esc(tasks.find((t) => t.id === p.task).title)} ${icon("arrow")}</button><button class="btn small" data-pr="${p.id}">${icon("file")}${p.state === "done" ? "View change" : "Review change"}</button></div></article>`,
        )
        .join("")
    : empty(
        "pr",
        "No pull requests yet",
        "A task can hold several PRs, or none at all. They will appear here as work progresses.",
        button("Start a session", "start-session", "plus"),
      );
}
function monitorsView(t) {
  const list = taskMonitors(t.id);
  return `<div class="block-heading" style="margin-top:0"><h2>What happened after shipping</h2>${button("Add monitor", "add-monitor", "plus", "small")}</div>${list.length ? list.map((m) => `<section class="monitor" style="margin-bottom:15px"><div class="monitor-head"><h3>${esc(m.title)}</h3>${pill(m.state, m.state === "done" ? "Verified" : m.state === "queued" ? "Awaiting deployment" : "Observing")}</div><p>PR #${m.pr} · ${m.state === "queued" ? "Waiting for the production deployment event" : m.state === "done" ? "Production · observation complete" : "Production · observation in progress"}</p><div class="chart" aria-label="Illustrative request volume">${[18, 26, 21, 33, 31, 39, 24, 35, 42, 31, 28, 48, 37, 44, 30, 40, 49, 45, 39, 57, 43, 36, 51, 48, 39, 55, 49, 60].map((n) => `<i style="height:${n + 10}%"></i>`).join("")}</div><div class="chart-labels"><span>Observation started</span><span>Sample request volume</span><span>${m.state === "done" ? "30 min" : "Now"}</span></div><div class="metrics"><div class="metric"><strong>${m.state === "queued" ? "—" : "0"}</strong><small>Related errors</small></div><div class="metric"><strong>${m.state === "queued" ? "—" : m.state === "done" ? "124" : "28"}</strong><small>Successful requests</small></div><div class="metric"><strong>${m.state === "done" ? "Passed" : "Pending"}</strong><small>Flow verification</small></div></div><div style="margin-top:20px">${m.state === "queued" ? `<button class="btn small" data-monitor="${m.id}" data-monitor-action="deploy">${icon("play")} Simulate deployment ready</button>` : m.state === "working" ? `<button class="btn small" data-monitor="${m.id}" data-monitor-action="complete">${icon("check")} Simulate verified result</button>` : "<small>Evidence: sample browser check, error counts, and deployment correlation.</small>"}</div></section>`).join("") : empty("activity", "Nothing is being monitored yet", "When a PR merges, a hook can attach a monitor and wait for the deployment.", button("Add a monitor", "add-monitor", "plus"))}`;
}
function timeline(list) {
  return list.length
    ? list
        .map(
          (e) =>
            `<div class="timeline-item"><span class="timeline-icon">${icon(e.icon)}</span><div><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p><small>${esc(e.time)} · <button data-task="${e.task}" style="font-size:10px;padding:0;color:#778a9e">${esc(tasks.find((t) => t.id === e.task).title)}</button></small></div></div>`,
        )
        .join("")
    : empty(
        "clock",
        "A fresh start",
        "Decisions, sessions, and changes will collect here as this task moves forward.",
        "",
      );
}
function empty(glyph, title, text, action) {
  return `<div class="empty">${icon(glyph)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
}
function companionView() {
  const key = contextKey();
  const t = current();
  const conversation = state.conversations[key] || [];
  return `<div class="companion-head">${icon("spark")}Companion <button class="icon-button" data-action="toggle-companion" aria-label="Close companion">${icon("close")}</button></div><div class="scope"><button data-scope="task" class="${key !== "workspace" ? "active" : ""}" ${state.view !== "task" ? "disabled" : ""}>This task</button><button data-scope="workspace" class="${key === "workspace" ? "active" : ""}">Whole workspace</button></div><div class="companion-body"><div class="companion-context">${icon(key === "workspace" ? "layers" : "circle")}${esc(key === "workspace" ? "Across all your work" : t.title)}</div>${conversation.length ? conversation.map((m) => `<div class="message ${m.role}">${m.role === "assistant" ? `<div class="byline">${icon("spark")} Companion · just now</div>` : ""}${m.html || esc(m.text)}${m.action ? button(m.label, m.action, "arrow", "small") : ""}</div>`).join("") : `<h3>${key === "workspace" ? "What would you like<br>to move forward?" : "The context is still here."}</h3><p>${key === "workspace" ? "I can help you find your place, connect the pieces, and decide what comes next." : "Ask where you left off, what changed, or what to do next. I’ll follow the sessions, decisions, and changes attached to this task."}</p><div class="suggestions">${(key === "workspace" ? ["What needs me today?", "Catch me up on checkout", "Find a Linear issue"] : ["What should I do now?", "What changed while I was away?", "Start a coding session"]).map((s) => `<button class="suggestion" data-ask="${esc(s)}">${s}${icon("arrow")}</button>`).join("")}</div><div class="companion-hint">${icon("link")} ${key === "workspace" ? "Connected to your workstreams, sessions, and delivery history." : "Context stays with the task, even when the work happens elsewhere."}</div>`}</div><form class="compose" id="companion-form"><textarea id="companion-input" aria-label="Message companion" placeholder="${key === "workspace" ? "Ask about anything in your workspace…" : "Ask about this task…"}" required></textarea><div class="compose-footer"><span>Prototype responses · no model connected</span><button class="send" aria-label="Send message">${icon("send")}</button></div></form>`;
}
function ask(text) {
  const key = contextKey();
  const t = current();
  const lower = text.toLowerCase();
  let html, action, label;
  if (key === "workspace") {
    if (/linear|coa[- ]?\d/.test(lower)) {
      html =
        "I found <strong>COA-274 · Explain cancellation terms before booking</strong> in the sample Linear inbox. It fits under <strong>A smoother checkout</strong>. I can bring it in with its description and source attached.";
      action = "import-linear";
      label = "Bring this issue into checkout";
    } else if (/checkout|catch|month|away/.test(lower)) {
      html = `<strong>A smoother checkout</strong><br><br>${esc(tasks[0].summary)}<br><br><strong>Next:</strong> ${esc(tasks[0].next)}`;
      action = "resume-checkout";
      label = "Open the checkout workstream";
    } else if (/monitor|merged/.test(lower)) {
      const missing = prs.filter(
        (p) => p.state === "done" && !monitors.some((m) => m.pr === p.id),
      );
      html = missing.length
        ? `I found ${missing.length} merged PR without a monitor. I can attach the missing monitor now.`
        : "Every merged PR in this workspace has a monitor attached. Package comparison can be followed automatically when it merges.";
      action = "hooks";
      label = "Inspect hooks and monitors";
    } else {
      html = `You have <strong>${tasks.filter((t) => t.parent && ["review", "blocked"].includes(t.status)).length} tasks waiting for your input</strong>.<br><br><strong>Checkout:</strong> ${esc(tasks[0].next)}<br><br><strong>Instructor availability:</strong> ${esc(tasks.find((t) => t.id === "instructors").next)}<br><br>Coast.ai is parked as an idea, with your earlier decisions preserved.`;
      action = "attention";
      label = "Show what needs me";
    }
  } else if (/start|coding|implement|claude|codex/.test(lower)) {
    html = `I’ll carry the description and decisions from <strong>${esc(t.title)}</strong> into a new session. You can choose the agent and keep this task as the common record.`;
    action = "start-session";
    label = "Choose an agent and start";
  } else if (/monitor/.test(lower)) {
    const list = taskMonitors(t.id);
    html = list.length
      ? `${list.length} monitor${list.length === 1 ? " is" : "s are"} attached to this task tree. Open them to see deployment status and the verification evidence.`
      : "There isn’t a monitor attached here yet. Add one to follow the next deployment and check the affected flow.";
    action = list.length ? "tab-monitors" : "add-monitor";
    label = list.length ? "Open monitors" : "Add a monitor";
  } else if (/decision|why/.test(lower)) {
    html = `The decision to carry forward is:<br><br><strong>${esc(t.decision)}</strong><br><br>${esc(t.status === "blocked" ? "This is still unresolved. You can make the call here and I’ll keep it attached to the task." : "The linked product discussion holds the original context. New sessions will receive this decision.")}`;
    action = t.status === "blocked" ? "decision" : "source-slack";
    label =
      t.status === "blocked"
        ? "Resolve the decision"
        : "Open the original discussion";
  } else {
    const ss = taskSessions(t.id),
      pp = taskPRs(t.id);
    html = `${esc(t.summary)}<br><br>${ss.length ? `You have <strong>${ss.length} coding session${ss.length === 1 ? "" : "s"}</strong> attached${pp.length ? `, with <strong>${pp.filter((p) => p.state === "done").length} merged PR${pp.filter((p) => p.state === "done").length === 1 ? "" : "s"}</strong> and <strong>${pp.filter((p) => p.state !== "done").length} awaiting review</strong>` : ""}.<br><br>` : ""}<strong>What I’d do next:</strong> ${esc(t.next)}`;
    action =
      t.status === "review"
        ? "review-current"
        : t.status === "blocked"
          ? "decision"
          : t.status === "idea"
            ? "new-child"
            : "tab-sessions";
    label =
      t.status === "review"
        ? "Review the pending change"
        : t.status === "blocked"
          ? "Make the decision"
          : t.status === "idea"
            ? "Break out a first task"
            : "Open the coding sessions";
  }
  (state.conversations[key] ??= []).push(
    { role: "user", text },
    { role: "assistant", html, action, label },
  );
  state.companion = true;
  render();
}
function hooksView() {
  return `<div class="content"><div class="page-heading"><div><div class="eyebrow">Things happen. Work moves.</div><h1>Hooks & automations</h1><p>Outside events can trigger the same actions you use here.</p></div></div>${hooks.map((h) => `<div class="hook-row"><span class="provider">${icon("bolt")}</span><div class="hook-text"><h3>${h.name}</h3><div class="hook-flow"><span>${h.source}</span>${icon("arrow")}<span>${h.result}</span></div></div><button class="toggle ${h.on ? "on" : ""}" data-hook="${h.id}" role="switch" aria-checked="${h.on}" aria-label="${h.name}"></button></div>`).join("")}<section class="simulation"><h2>Try an incoming event</h2><p>Simulate a webhook and watch the task, activity, and companion context update. No external service is contacted.</p><div class="simulation-controls"><select id="event-type" aria-label="Event to simulate"><option value="merge">GitHub · PR #6842 merged</option><option value="deployment">Deployment · PR #6842 ready</option><option value="session">Codex · Calendar session finished</option><option value="linear">Linear · COA-274 assigned to you</option></select>${button("Send event", "simulate", "play", "primary")}</div></section><div class="block-heading"><h2>Recent executions</h2><small>Duplicate events are safe to replay</small></div>${executions.map((x) => `<div class="execution">${icon(x.state === "done" ? "check" : "clock")}<div>${esc(x.title)}<small style="display:block;margin-top:5px">${x.time}</small></div>${pill(x.state, x.state === "done" ? "Completed" : "Skipped")}</div>`).join("")}</div>`;
}
function settingsView() {
  return `<div class="content"><div class="page-heading"><div><div class="eyebrow">Harvey’s workspace</div><h1>Workspace settings</h1><p>A place for your work, wherever it happens.</p></div></div><h2>Connected sources</h2>${[
    ["layers", "Linear", "Issues, descriptions, and acceptance criteria"],
    ["pr", "GitHub", "Pull requests, checks, and deployment events"],
    ["chat", "Slack", "Conversations and decisions"],
    ["activity", "Monitoring", "Deployment health and verification evidence"],
  ]
    .map(
      ([i, n, d]) =>
        `<div class="connection"><span class="provider">${icon(i)}</span><div><strong>${n}</strong><p>${d}</p></div>${pill("idea", "Simulated")}</div>`,
    )
    .join(
      "",
    )}<div class="block-heading"><h2>Coding agents</h2></div><p class="description">Codex, Claude Code, and OpenCode are available as simulated sessions. Each session can be viewed as a conversation or terminal.</p><div class="block-heading"><h2>Companion scope</h2></div><p class="description">One companion can look across the workspace or focus on the selected task. Conversations stay with their scope so you can return to them later.</p><div class="block-heading"><h2>About this prototype</h2></div><p class="description">All people, issues, PRs, messages, and metrics are sample data. Changes stay in memory until the page is refreshed. Nothing is sent to a model, GitHub, Linear, Slack, or a real terminal.</p><div style="margin-top:20px">${button("Reset to the starting scenario", "reset", "clock")}</div></div>`;
}
function showModal(title, body, footer = "") {
  const modal = $("#modal");
  modal.innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon("close")}</button></div>${body}${footer ? `<div class="modal-foot">${footer}</div>` : ""}`;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  $("#modal").close();
}
function newTask(parent = null, edit = false) {
  const t = current();
  showModal(
    edit ? "Edit task" : "Make room for a new thought",
    `<form id="task-form" class="modal-body" data-edit="${edit ? t.id : ""}"><label for="task-title">${edit ? "Task name" : "What’s on your mind?"}</label><input class="field" id="task-title" name="title" placeholder="A bug, an idea, or something bigger…" value="${edit ? esc(t.title) : ""}" required autofocus><label for="task-description">A little context</label><textarea class="field" id="task-description" name="description" placeholder="What do you want to accomplish?">${edit ? esc(t.description) : ""}</textarea>${edit ? "" : `<label for="task-parent">Where does it belong?</label><select id="task-parent" name="parent"><option value="">New workstream</option>${tasks.map((t) => `<option value="${t.id}" ${parent === t.id ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select>`}<button class="btn primary" type="submit">${edit ? "Save changes" : "Create task"} ${icon("arrow")}</button></form>`,
  );
  $("#task-title").focus();
}
function startSession() {
  showModal(
    "Start a coding session",
    `<form id="session-form" class="modal-body"><p class="modal-description">Attached to <strong>${esc(current().title)}</strong>. The task brief and decisions will travel with it.</p><label for="provider">Agent</label><select id="provider" name="provider"><option>Codex</option><option>Claude Code</option><option>OpenCode</option></select><label for="session-prompt">What should it work on?</label><textarea id="session-prompt" name="prompt" class="field" required>${esc(current().next)}</textarea><label for="session-display">Open as</label><select id="session-display" name="display"><option value="chat">Conversation</option><option value="terminal">Terminal</option></select><button class="btn primary" type="submit">${icon("play")} Start simulated session</button></form>`,
  );
}
function sessionModal(id) {
  state.session = id;
  const s = sessions.find((s) => s.id === id);
  showModal(
    esc(s.title),
    `<div class="modal-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px"><div class="segmented"><button data-session-mode="chat" class="${state.sessionMode === "chat" ? "active" : ""}">Conversation</button><button data-session-mode="terminal" class="${state.sessionMode === "terminal" ? "active" : ""}">Terminal</button></div>${pill(s.state === "working" ? "working" : "done", s.state === "working" ? "Working" : "Turn finished")}</div><div class="detail-label">${esc(s.provider)} · isolated workspace · simulated</div>${state.sessionMode === "terminal" ? `<div class="terminal"><span class="prompt">❯ ${s.provider === "Claude Code" ? "claude" : s.provider === "OpenCode" ? "opencode" : "codex"}</span>\n\nTask context loaded: ${esc(tasks.find((t) => t.id === s.task).title)}\nDecisions and linked issues attached.\n\n${esc(s.summary)}\n\n${s.messages.map((m) => `❯ ${esc(m)}\nNoted. Continuing with the updated task context.`).join("\n\n")}\n\n<span class="prompt">${s.state === "working" ? "● Working on the current turn…" : "✓ Turn finished. Ready for your next instruction."}</span></div>` : `<div class="chat-reply"><strong>${esc(s.provider)}</strong><br>${esc(s.summary)}<br><br>${s.state === "working" ? "I’m working in the task’s isolated workspace. You can leave this session and return from the task." : "The result and changed files stay attached to this task. Send a follow-up whenever you’re ready."}</div>${s.messages.map((m) => `<div class="chat-reply" style="margin-left:25px"><strong>You</strong><br>${esc(m)}</div><div class="chat-reply"><strong>${esc(s.provider)}</strong><br>I’ve added that instruction to this simulated session and resumed the work.</div>`).join("")}`}<form class="terminal-input" id="session-message-form"><input class="field" style="margin:0" name="message" aria-label="Session instruction" placeholder="Send a follow-up to this session…" required><button class="btn primary">Send</button></form></div>`,
    `${s.state === "idle" ? button("Create pull request", "create-pr", "pr") : ""}${button(s.state === "working" ? "Finish simulated turn" : "Resume session", "session-toggle", s.state === "working" ? "check" : "play")}`,
  );
}
function prModal(id) {
  const p = prs.find((p) => p.id === id);
  showModal(
    `PR #${p.id} · ${esc(p.title)}`,
    `<div class="modal-body"><div style="display:flex;gap:8px">${pill(p.state, p.state === "done" ? "Merged" : "Ready for review")}${pill("done", "Checks passed")}</div><p class="modal-description" style="margin-top:16px">${esc(p.id === 6842 ? "Students can compare lesson packages and total prices on a single screen. Keyboard focus follows the selected package." : "Students can resume a pending payment without creating a second payment intent.")}</p><div class="code-diff"><div class="filename">${p.id === 6842 ? "components/checkout/PackageSelection.tsx" : "server/payments/recoverPayment.ts"} · illustrative diff</div><pre>  return (
<span class="remove">-   &lt;PackageDropdown packages={packages} /&gt;</span><span class="add">+   &lt;PackageComparison</span><span class="add">+     packages={packages}</span><span class="add">+     selectedId={selectedPackageId}</span><span class="add">+     onSelect={setSelectedPackageId}</span><span class="add">+   /&gt;</span>  )</pre></div><div class="note">Reviewer summary: the change matches the brief. Total prices stay visible, and keyboard navigation follows the radio-group pattern.</div></div>`,
    `${p.id === 6842 ? button("Open product preview", "preview", "monitor") : ""}${p.state === "done" ? button("View monitor", "pr-monitor-" + p.id, "activity", "primary") : `<button class="btn primary" data-merge="${p.id}">${icon("branch")} Merge PR</button>`}`,
  );
}
function previewModal() {
  showModal(
    "Preview · Choose your lesson package",
    `<div class="modal-body"><div class="eyebrow">Coastline · sample checkout</div><h1 style="font-size:23px;margin-bottom:8px">A little practice. A lot of confidence.</h1><p class="modal-description">Select a package to try the interaction.</p><form id="preview-form">${[
      ["starter", "3 lessons", "$399"],
      ["recommended", "6 lessons", "$749"],
      ["complete", "10 lessons", "$1,199"],
    ]
      .map(
        ([id, title, price], i) =>
          `<label style="display:flex;align-items:center;gap:12px;border:1px solid #dce3eb;padding:17px;border-radius:8px;margin-bottom:10px;color:#455569"><input type="radio" name="package" value="${title}" ${i === 1 ? "checked" : ""}><span>${title}${i === 1 ? '<small style="display:block;margin-top:5px">Recommended</small>' : ""}</span><strong style="margin-left:auto">${price}</strong></label>`,
      )
      .join(
        "",
      )}<button class="btn primary" style="width:100%;margin-top:10px">Continue with this package ${icon("arrow")}</button></form><p style="font-size:10px;color:#a1a9b5;margin-top:13px;text-align:center">Interactive sample · no purchase or real checkout</p></div>`,
  );
}
function addMonitor(pr) {
  if (monitors.some((m) => m.pr === pr.id)) return false;
  monitors.push({
    id: "m" + Date.now(),
    task: pr.task,
    pr: pr.id,
    state: "queued",
    title: tasks.find((t) => t.id === pr.task).title + " · production",
  });
  event(
    pr.task,
    "Deployment monitor attached",
    `PR #${pr.id} will be checked when its production deployment is ready.`,
    "activity",
  );
  return true;
}
function mergePR(id) {
  const p = prs.find((p) => p.id === id);
  if (p.state === "done") {
    executions.unshift({
      title: `PR #${id} merge already processed; no duplicate work created`,
      time: "Just now",
      state: "skipped",
    });
    return;
  }
  p.state = "done";
  const t = tasks.find((t) => t.id === p.task);
  t.status = "working";
  t.age = "a moment";
  t.summary = `PR #${p.id} merged. The implementation is complete. ${hooks[0].on ? "A monitor is attached and waiting for deployment." : "No monitor is attached because the merge hook is disabled."}`;
  t.next = hooks[0].on
    ? "Wait for deployment, then check the monitor’s evidence."
    : "Attach a monitor to verify the change after deployment.";
  if (p.id === 6842) {
    tasks[0].status = "working";
    tasks[0].summary = `Both checkout PRs have merged. Payment recovery was verified. ${hooks[0].on ? "Package comparison is waiting for deployment before its monitor runs." : "Package comparison still needs a production monitor."}`;
    tasks[0].next = t.next;
  }
  event(
    t.id,
    `PR #${p.id} merged`,
    "The task brief has been updated with the result.",
    "pr",
  );
  if (hooks[0].on) addMonitor(p);
  executions.unshift({
    title: `PR #${id} merged → ${hooks[0].on ? "monitor attached" : "merge hook disabled"}`,
    time: "Just now",
    state: hooks[0].on ? "done" : "skipped",
  });
}
function importLinear() {
  const existing = tasks.find((t) => t.issue === "COA-274");
  if (existing) return existing;
  const t = {
    id: "cancellation",
    parent: "checkout",
    title: "Explain cancellation terms",
    status: "idea",
    repo: "coastline / next",
    issue: "COA-274",
    age: "a moment",
    description:
      "Show the cancellation window before students confirm a booking. Keep the language short and link to the full policy.",
    summary:
      "This issue was brought in from the sample Linear inbox. No coding has started. The acceptance criteria and original issue are attached.",
    next: "Review the wording, then start an implementation session.",
    decision:
      "Explain the policy before confirmation, with a link to the full terms.",
  };
  tasks.push(t);
  event(
    t.id,
    "Linear issue brought into checkout",
    "COA-274 is now linked to a task.",
    "layers",
  );
  return t;
}
function simulate(type) {
  if (type === "merge") mergePR(6842);
  if (type === "deployment") {
    const m = monitors.find((m) => m.pr === 6842);
    if (!m) {
      notify("Merge PR #6842 and attach its monitor first.");
      return;
    }
    if (m.state === "queued") {
      m.state = "working";
      event(
        m.task,
        "Production deployment is ready",
        "The monitor is now observing package comparison.",
        "activity",
      );
      executions.unshift({
        title: "Deployment ready → monitor started for PR #6842",
        time: "Just now",
        state: "done",
      });
    } else
      executions.unshift({
        title: "Deployment event already processed; monitor unchanged",
        time: "Just now",
        state: "skipped",
      });
  }
  if (type === "session") {
    sessions.find((s) => s.id === "s4").state = "idle";
    if (hooks[1].on) {
      const t = tasks.find((t) => t.id === "calendar");
      t.status = "review";
      t.summary =
        "Codex finished the weekly calendar implementation. The simulated session is ready for you to inspect; no PR has been opened yet.";
      t.next = "Open the completed session and review the implementation.";
      event(
        t.id,
        "Codex finished the calendar implementation",
        "The task companion refreshed the brief.",
        "terminal",
      );
    }
    executions.unshift({
      title: `Calendar session finished → ${hooks[1].on ? "brief refreshed" : "brief hook disabled"}`,
      time: "Just now",
      state: hooks[1].on ? "done" : "skipped",
    });
  }
  if (type === "linear") {
    if (hooks[2].on) importLinear();
    executions.unshift({
      title: hooks[2].on
        ? "COA-274 assigned → task linked under checkout"
        : "COA-274 received → assignment hook is disabled",
      time: "Just now",
      state: hooks[2].on ? "done" : "skipped",
    });
  }
  render();
  notify("Sample event processed. Task state and activity are updated.");
}
function sourceModal(kind) {
  const t = current();
  showModal(
    kind === "linear"
      ? `${esc(t.issue || "Working brief")} · ${esc(t.title)}`
      : "Product discussion · Slack",
    `<div class="modal-body"><div class="detail-label">Linked source · sample content</div>${kind === "linear" ? `<p class="description">${esc(t.description)}</p><div class="block-heading"><h2>Acceptance criteria</h2></div><p class="description">• The change addresses the task’s stated outcome.<br>• Existing behavior remains intact.<br>• The affected flow is checked before the task is closed.</p>` : `<div class="chat-reply"><strong>Harvey · Sep 2, 10:12 AM</strong><br>${esc(t.decision)}</div><div class="chat-reply"><strong>Alex · Sep 2, 10:15 AM</strong><br>That makes sense. Let’s keep this attached to the task so we don’t have to reconstruct it next time.</div>`}<div class="banner">This source is represented inside the prototype. No external application is opened.</div></div>`,
  );
}
function searchModal() {
  showModal(
    "Find your place",
    `<input id="search-input" class="search-input" placeholder="Search tasks, ideas, issues…" aria-label="Search tasks"><div id="search-results">${searchResults("")}</div><div class="search-footer">⌘ K from anywhere · Escape to close</div>`,
  );
  $("#search-input").focus();
}
function searchResults(q) {
  const matches = tasks.filter((t) =>
    `${t.title} ${t.issue || ""} ${t.description}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return matches.length
    ? matches
        .map(
          (t) =>
            `<button class="search-result" data-search-task="${t.id}">${icon(t.parent ? "circle" : "layers")}${esc(t.title)}<small>${esc(t.issue || "Idea")}</small></button>`,
        )
        .join("")
    : '<p class="modal-body muted">No matching tasks. Try “checkout,” “calendar,” or an issue number.</p>';
}
const actions = {
  home: () => {
    state.view = "home";
    render();
  },
  attention: () => {
    state.view = "attention";
    render();
  },
  activity: () => {
    state.view = "activity";
    render();
  },
  hooks: () => {
    state.view = "hooks";
    render();
  },
  settings: () => {
    state.view = "settings";
    render();
  },
  search: searchModal,
  menu: () => $(".sidebar").classList.toggle("open"),
  "toggle-companion": () => {
    state.companion = !state.companion;
    render();
  },
  new: () => newTask(),
  "new-child": () => newTask(state.task),
  "edit-task": () => newTask(null, true),
  "close-modal": closeModal,
  "catch-up-checkout": () => {
    openTask("checkout");
    ask("What should I do now?");
  },
  "resume-checkout": () => openTask("checkout"),
  "catch-up": () => ask("What should I do now?"),
  "start-session": startSession,
  "tab-sessions": () => {
    state.tab = "sessions";
    render();
  },
  "tab-monitors": () => {
    state.tab = "monitors";
    render();
  },
  "review-current": () => {
    const p = taskPRs(state.task).find((p) => p.state === "review");
    if (p) prModal(p.id);
    else {
      state.tab = "sessions";
      render();
      notify("The completed session is ready to review. No PR is open yet.");
    }
  },
  "source-linear": () => sourceModal("linear"),
  "source-slack": () => sourceModal("slack"),
  preview: previewModal,
  "add-monitor": () => {
    const p = taskPRs(state.task).find(
      (p) => !monitors.some((m) => m.pr === p.id),
    );
    if (p) {
      addMonitor(p);
      state.tab = "monitors";
      render();
      notify("Monitor attached. It will wait for the production deployment.");
    } else {
      notify(
        taskPRs(state.task).length
          ? "Every linked PR already has a monitor."
          : "Link a PR before adding a deployment monitor.",
      );
    }
  },
  "create-pr": () => {
    const s = sessions.find((s) => s.id === state.session);
    const existing = prs.find((p) => p.task === s.task && p.state === "review");
    if (existing) {
      prModal(existing.id);
      return;
    }
    const t = tasks.find((t) => t.id === s.task);
    const p = {
      id: Math.max(...prs.map((p) => p.id)) + 1,
      task: t.id,
      title: "Implement " + t.title.toLowerCase(),
      state: "review",
      add: 82,
      remove: 14,
      branch: "prototype/" + t.id,
    };
    prs.push(p);
    t.status = "review";
    t.summary = `${s.provider} finished the implementation. PR #${p.id} is ready for review with passing sample checks.`;
    t.next = `Review PR #${p.id}, then merge and monitor the deployment.`;
    event(t.id, `PR #${p.id} opened`, p.title, "pr");
    closeModal();
    openTask(t.id, "changes");
    prModal(p.id);
  },
  "import-linear": () => {
    const t = importLinear();
    openTask(t.id);
    notify("COA-274 is now part of your checkout workstream.");
  },
  "session-toggle": () => {
    const s = sessions.find((s) => s.id === state.session);
    s.state = s.state === "working" ? "idle" : "working";
    s.summary =
      s.state === "idle"
        ? "The simulated turn finished. Changes are ready for review."
        : "Continuing work with the task brief and your latest instructions.";
    if (hooks[1].on) {
      const t = tasks.find((t) => t.id === s.task);
      t.summary = s.summary;
      t.next =
        s.state === "idle"
          ? "Review the session result and decide what comes next."
          : "Let the session finish or send a follow-up.";
      t.status = s.state === "idle" ? "review" : "working";
    }
    event(
      s.task,
      `${s.provider} ${s.state === "idle" ? "finished its turn" : "resumed work"}`,
      s.summary,
      "terminal",
    );
    render();
    sessionModal(s.id);
  },
  simulate: () => simulate($("#event-type").value),
  decision: () =>
    showModal(
      "Resolve the schedule conflict behavior",
      `<div class="modal-body"><p class="description">Operations suggested letting instructors save overlapping availability with a clear warning. The original issue requested a hard block.</p><div class="note">Your decision will be recorded on the task and included in the next coding session.</div></div>`,
      `<button class="btn" data-decision="block">Block overlapping availability</button><button class="btn primary" data-decision="warn">Warn and allow saving</button>`,
    ),
  status: () =>
    showModal(
      "Update task status",
      `<div class="modal-body">${Object.entries(statusNames)
        .map(
          ([k, v]) =>
            `<button class="search-result" data-status="${k}">${pill(k, v)}</button>`,
        )
        .join("")}</div>`,
    ),
  dev: () =>
    showModal(
      "Development workspace",
      `<div class="modal-body"><div class="detail-label">coastline / next · sample process</div><div class="terminal"><span class="prompt">❯ pnpm dev</span>\n\n${state.dev ? "✓ Workspace dependencies ready\n✓ Local preview running\n\nRoute: /checkout/packages\nNo errors in the simulated build." : "Dev preview is stopped.\nStart it here to keep your workspace together.\n\nThis is a simulated terminal; no command will execute."}</div></div>`,
      `${state.dev ? button("Open preview", "preview", "monitor") : ""}${button(state.dev ? "Stop preview" : "Start preview", "dev-toggle", state.dev ? "stop" : "play", "primary")}`,
    ),
  "dev-toggle": () => {
    state.dev = !state.dev;
    render();
    actions.dev();
  },
  reset: () =>
    showModal(
      "Reset the prototype?",
      `<div class="modal-body"><p class="description">Return to the original sample workstreams. Tasks, conversations, and simulated actions from this visit will be cleared.</p></div>`,
      button("Keep exploring", "close-modal", null) +
        button("Reset demo", "confirm-reset", "clock", "primary"),
    ),
  "confirm-reset": () => location.reload(),
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.action) {
    const action = el.dataset.action;
    if (action.startsWith("pr-monitor-")) {
      const p = prs.find((p) => p.id === Number(action.split("-").pop()));
      closeModal();
      openTask(p.task, "monitors");
    } else actions[action]?.();
  } else if (el.dataset.task) openTask(el.dataset.task);
  else if (el.dataset.expand) {
    state.expanded.has(el.dataset.expand)
      ? state.expanded.delete(el.dataset.expand)
      : state.expanded.add(el.dataset.expand);
    render();
  } else if (el.dataset.tab) {
    state.tab = el.dataset.tab;
    render();
  } else if (el.dataset.scope) {
    state.scope = el.dataset.scope;
    render();
  } else if (el.dataset.ask) ask(el.dataset.ask);
  else if (el.dataset.session) sessionModal(el.dataset.session);
  else if (el.dataset.sessionMode) {
    state.sessionMode = el.dataset.sessionMode;
    sessionModal(state.session);
  } else if (el.dataset.pr) prModal(Number(el.dataset.pr));
  else if (el.dataset.merge) {
    mergePR(Number(el.dataset.merge));
    closeModal();
    state.tab = "monitors";
    render();
    notify(
      hooks[0].on
        ? "PR merged. The merge hook created its deployment monitor."
        : "PR merged. The merge hook is disabled; add a monitor manually.",
    );
  } else if (el.dataset.hook) {
    const h = hooks.find((h) => h.id === el.dataset.hook);
    h.on = !h.on;
    render();
  } else if (el.dataset.monitor) {
    const m = monitors.find((m) => m.id === el.dataset.monitor);
    m.state = el.dataset.monitorAction === "deploy" ? "working" : "done";
    const t = tasks.find((t) => t.id === m.task);
    if (m.state === "done") {
      t.status = "done";
      t.summary = `PR #${m.pr} deployed and its monitor verified the affected flow. No related errors were observed in the sample window.`;
      t.next =
        "No action needed. Implementation and production verification are complete.";
    } else {
      t.summary = `PR #${m.pr} is deployed. The monitor is observing production and checking the affected flow.`;
      t.next =
        "Wait for the monitoring result before marking this task complete.";
    }
    if (t.parent === "checkout" && m.pr === 6842) {
      tasks[0].summary = `Both checkout PRs have merged and deployed. ${m.state === "done" ? "Their monitors verified the affected flows." : "Package comparison is being observed; payment recovery is verified."}`;
      tasks[0].next =
        m.state === "done"
          ? "Review the final evidence and close the workstream."
          : "Check the package comparison monitor when observation finishes.";
      if (
        m.state === "done" &&
        descendants("checkout")
          .slice(1)
          .every((id) => tasks.find((t) => t.id === id).status === "done")
      )
        tasks[0].status = "done";
    }
    event(
      m.task,
      m.state === "done"
        ? "Monitor verified the production flow"
        : "Monitor started observing production",
      "The task brief now reflects the latest evidence.",
      "activity",
    );
    render();
  } else if (el.dataset.searchTask) {
    closeModal();
    openTask(el.dataset.searchTask);
  } else if (el.dataset.decision) {
    const t = tasks.find((t) => t.id === "conflicts");
    t.decision =
      el.dataset.decision === "warn"
        ? "Show a clear warning for overlapping availability and allow saving."
        : "Prevent saving overlapping availability and explain the conflict.";
    t.status = "working";
    t.summary =
      "You resolved the product decision. The task is ready for implementation with the agreed behavior.";
    t.next = "Start an implementation session with the recorded decision.";
    const parent = tasks.find((t) => t.id === "instructors");
    parent.summary =
      "The weekly calendar is underway. You resolved the overlap decision; conflict handling is ready for implementation.";
    parent.next =
      "Start a session for conflict handling, or check the calendar session.";
    event(t.id, "You resolved the conflict behavior", t.decision, "chat");
    closeModal();
    openTask(t.id);
    notify("Decision recorded and included in the task context.");
  } else if (el.dataset.status) {
    current().status = el.dataset.status;
    event(
      state.task,
      `Task marked ${statusNames[el.dataset.status].toLowerCase()}`,
      "Updated by you.",
      "circle",
    );
    closeModal();
    render();
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target,
    data = new FormData(f);
  if (f.id === "companion-form") {
    const text = $("#companion-input").value.trim();
    if (text) ask(text);
  }
  if (f.id === "task-form") {
    const title = data.get("title").trim();
    if (!title) {
      $("#task-title").focus();
      return;
    }
    if (f.dataset.edit) {
      const t = tasks.find((t) => t.id === f.dataset.edit);
      t.title = title;
      t.description = data.get("description");
      closeModal();
      render();
    } else {
      const parent = data.get("parent") || null;
      const t = {
        id: "task-" + Date.now(),
        parent,
        title,
        status: "idea",
        repo: parent
          ? tasks.find((t) => t.id === parent).repo
          : "No repository yet",
        issue: null,
        age: "a moment",
        description: data.get("description") || "A new idea, ready to explore.",
        summary:
          "You just captured this thought. There are no coding sessions or changes yet. This is a good place to work out what success would look like.",
        next: "Talk through the idea, or break out a first subtask.",
        decision: "No decisions recorded yet.",
      };
      tasks.push(t);
      event(
        t.id,
        "You captured a new task",
        "The idea now has a place to grow.",
        "idea",
      );
      closeModal();
      openTask(t.id);
      notify("Task created. You can add children, context, and sessions.");
    }
  }
  if (f.id === "session-form") {
    const s = {
      id: "s" + Date.now(),
      task: state.task,
      title: data.get("prompt").trim().slice(0, 70),
      provider: data.get("provider"),
      state: "working",
      summary:
        "Task context loaded. Exploring the relevant files and planning the implementation.",
      time: "Just started",
      messages: [],
    };
    sessions.push(s);
    state.sessionMode = data.get("display");
    current().status = "working";
    event(state.task, `${s.provider} session started`, s.title, "terminal");
    closeModal();
    state.tab = "sessions";
    render();
    sessionModal(s.id);
  }
  if (f.id === "session-message-form") {
    const s = sessions.find((s) => s.id === state.session);
    s.messages.push(data.get("message"));
    s.state = "working";
    event(
      s.task,
      "You continued the coding session",
      data.get("message"),
      "chat",
    );
    render();
    sessionModal(s.id);
  }
  if (f.id === "preview-form") {
    notify(
      `${data.get("package")} selected. Sample checkout interaction complete.`,
    );
    showModal(
      "Package selected",
      `<div class="modal-body"><div class="empty">${icon("check")}<h3>${esc(data.get("package"))}</h3><p>The selected package would continue to student details. This preview ends here without creating a booking.</p>${button("Return to PR review", "review-current", "arrow")}</div></div>`,
    );
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search-input")
    $("#search-results").innerHTML = searchResults(e.target.value);
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchModal();
  }
  if (e.target.id === "companion-input" && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#companion-form").requestSubmit();
  }
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});
render();
