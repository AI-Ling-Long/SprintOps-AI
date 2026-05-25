const EMPTY_STATES = {
  "git-activity-empty": {
    label: "GitHub not connected",
    text: "Connect GitHub so SprintOps AI can prepare repository activity tracking.",
    action: "Connect GitHub",
    actionType: "connect-github",
  },
  "goals-empty": {
    label: "No goals yet",
    text: "Create a daily goal to start tracking what you want to finish.",
    action: "Add Goal",
    actionType: "add-goal",
  },
  "feedback-empty": {
    label: "Waiting for real activity",
    text: "AI feedback will be generated after SprintOps AI has commits, goals, or task history to review.",
    action: "Configure AI",
    actionType: "configure-ai",
  },
  "projects-empty": {
    label: "No projects tracked",
    text: "Projects you connect will appear here with real status and recent activity.",
    action: "Add Project",
    actionType: "add-project",
  },
};

const PAGE_TITLES = {
  dashboard: "Dashboard",
  goals: "Goals",
  projects: "Projects",
  git: "Git Activity",
  feedback: "AI Feedback",
  analytics: "Analytics",
  streaks: "Streaks",
  settings: "Settings",
};

let dashboardUser = null;
let activePage = "dashboard";
let workspaceState = createDefaultWorkspaceState();

function createDefaultWorkspaceState() {
  return {
    goals: [],
    projects: [],
    repositories: [],
    githubConnection: null,
    aiEnabled: false,
    checkIns: [],
    preferences: {
      dailyReminders: true,
      weeklySummary: true,
      aiAfterSession: false,
    },
  };
}

function getStateKey() {
  return `jarvis.workspace.${dashboardUser?.id || dashboardUser?.email || "guest"}`;
}

function loadWorkspaceState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(getStateKey()) || "{}");

    workspaceState = {
      ...createDefaultWorkspaceState(),
      ...savedState,
      preferences: {
        ...createDefaultWorkspaceState().preferences,
        ...(savedState.preferences || {}),
      },
    };
  } catch {
    workspaceState = createDefaultWorkspaceState();
  }
}

function saveWorkspaceState() {
  localStorage.setItem(getStateKey(), JSON.stringify(workspaceState));
}

function syncGitHubConnectionFromUser() {
  if (workspaceState.githubConnection || dashboardUser?.provider !== "github") return;

  workspaceState.githubConnection = {
    id: dashboardUser.id,
    name: dashboardUser.name,
    email: dashboardUser.email,
    avatarUrl: dashboardUser.avatarUrl,
    connectedAt: new Date().toISOString(),
  };

  saveWorkspaceState();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(name, email) {
  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  return String(email || "?").slice(0, 2).toUpperCase();
}

function getFirstName(name, email) {
  if (name) return name.split(/\s+/)[0];
  return String(email || "there").split("@")[0];
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function formatHeaderDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function getTodayGoals() {
  return workspaceState.goals.filter((goal) => isToday(goal.createdAt));
}

function getCompletedGoals() {
  return workspaceState.goals.filter((goal) => goal.done);
}

function getCurrentStreak() {
  const days = [...new Set(workspaceState.checkIns.map((date) => new Date(date).toDateString()))];
  let streak = 0;
  const cursor = new Date();

  while (days.includes(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getBestStreak() {
  const days = [...new Set(workspaceState.checkIns.map((date) => new Date(date).toDateString()))]
    .map((date) => new Date(date))
    .sort((a, b) => a - b);

  let best = 0;
  let current = 0;
  let previous = null;

  days.forEach((day) => {
    if (!previous) {
      current = 1;
    } else {
      const difference = Math.round((day - previous) / 86400000);
      current = difference === 1 ? current + 1 : 1;
    }

    best = Math.max(best, current);
    previous = day;
  });

  return best;
}

function renderEntityList(items, emptyId, renderItem) {
  if (!items.length) return `<div class="empty-state" id="${emptyId}"></div>`;

  return `<div class="entity-list">${items.map(renderItem).join("")}</div>`;
}

function renderGoalList() {
  return renderEntityList(workspaceState.goals, "goals-empty", (goal) => `
    <article class="entity-item ${goal.done ? "complete" : ""}">
      <label>
        <input type="checkbox" data-action="toggle-goal" data-id="${goal.id}" ${goal.done ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(goal.title)}</strong>
          <small>${formatShortDate(goal.createdAt)}</small>
        </span>
      </label>
      <button type="button" class="entity-remove" data-action="delete-goal" data-id="${goal.id}" aria-label="Delete goal">Delete</button>
    </article>
  `);
}

function renderProjectList() {
  return renderEntityList(workspaceState.projects, "projects-empty", (project) => `
    <article class="entity-item">
      <span>
        <strong>${escapeHtml(project.name)}</strong>
        <small>${escapeHtml(project.status)} - ${formatShortDate(project.createdAt)}</small>
      </span>
      <button type="button" class="entity-remove" data-action="delete-project" data-id="${project.id}" aria-label="Delete project">Delete</button>
    </article>
  `);
}

function renderRepositoryList() {
  if (!workspaceState.githubConnection) {
    return `<div class="empty-state" id="git-activity-empty"></div>`;
  }

  if (!workspaceState.repositories.length) {
    const connection = workspaceState.githubConnection;

    return `
      <div class="github-connection">
        <div class="github-connection-icon" aria-hidden="true">GH</div>
        <div>
          <strong>${escapeHtml(connection.name || connection.email || "GitHub connected")}</strong>
          <span>${escapeHtml(connection.email || "Connected with GitHub")}</span>
          <small>Connected ${formatShortDate(connection.connectedAt)}</small>
        </div>
        <button type="button" class="entity-remove" data-action="disconnect-github">Disconnect</button>
      </div>
    `;
  }

  return renderEntityList(workspaceState.repositories, "git-activity-empty", (repository) => `
    <article class="entity-item">
      <span>
        <strong>${escapeHtml(repository.name)}</strong>
        <small>${escapeHtml(repository.branch)} - connected ${formatShortDate(repository.connectedAt)}</small>
      </span>
      <button type="button" class="entity-remove" data-action="delete-repository" data-id="${repository.id}" aria-label="Disconnect repository">Disconnect</button>
    </article>
  `);
}

function renderFeedbackContent() {
  if (!workspaceState.aiEnabled) {
    return `<div class="empty-state" id="feedback-empty"></div>`;
  }

  const completedGoals = getCompletedGoals().length;
  const repositories = workspaceState.repositories.length;

  return `
    <div class="feedback-summary">
      <strong>AI feedback is enabled</strong>
      <p>${completedGoals} completed goals and ${repositories} connected repositories are ready for review signals.</p>
      <button type="button" class="empty-state-action" data-action="configure-ai">Update AI</button>
    </div>
  `;
}

function renderEmptyState(element, state) {
  element.innerHTML = `
    <div class="empty-state-icon" aria-hidden="true"></div>
    <div>
      <h4>${state.label}</h4>
      <p>${state.text}</p>
      <button type="button" class="empty-state-action" data-action="${state.actionType}">${state.action}</button>
    </div>
  `;
}

function renderEmptyStates() {
  Object.entries(EMPTY_STATES).forEach(([id, state]) => {
    const element = document.getElementById(id);

    if (element) {
      renderEmptyState(element, state);
    }
  });
}

function renderDashboardPage() {
  const initials = escapeHtml(getInitials(dashboardUser?.name, dashboardUser?.email));
  const firstName = escapeHtml(getFirstName(dashboardUser?.name, dashboardUser?.email));

  return `
    <section class="dash-card welcome-banner">
      <div class="welcome-left">
        <div class="welcome-avatar" id="welcome-avatar">${initials}</div>
        <div>
          <h2 id="welcome-greeting">${getGreeting()}, ${firstName}!</h2>
          <p>Your workspace is ready. Connect real activity to start tracking progress.</p>
        </div>
      </div>
    </section>

    <section class="setup-grid">
      <article class="dash-card setup-card">
        <span class="setup-step">01</span>
        <h3>Connect GitHub</h3>
        <p>Authorize GitHub so SprintOps AI can prepare repository activity tracking.</p>
        <button type="button" class="btn-outline" data-action="connect-github">
          ${workspaceState.githubConnection ? "Reconnect GitHub" : "Connect GitHub"}
        </button>
      </article>

      <article class="dash-card setup-card">
        <span class="setup-step">02</span>
        <h3>Create your first goal</h3>
        <p>Add a daily target so progress can be measured against something real.</p>
        <button type="button" class="btn-outline" data-action="add-goal">Add Goal</button>
      </article>

      <article class="dash-card setup-card">
        <span class="setup-step">03</span>
        <h3>Enable AI feedback</h3>
        <p>Once activity exists, SprintOps AI can summarize patterns and suggest improvements.</p>
        <button type="button" class="btn-outline" data-action="configure-ai">Configure AI</button>
      </article>
    </section>

    <section class="dash-row-2">
      <article class="dash-card">
        <div class="card-header">
          <h3>Git Activity</h3>
        </div>
        ${renderRepositoryList()}
      </article>

      <article class="dash-card">
        <div class="card-header">
          <h3>Goals</h3>
          <button type="button" class="btn-add-task" data-action="add-goal">Add Task</button>
        </div>
        ${renderGoalList()}
      </article>
    </section>

    <section class="dash-row-2">
      <article class="dash-card">
        <div class="card-header">
          <h3>AI Feedback</h3>
        </div>
        ${renderFeedbackContent()}
      </article>

      <article class="dash-card">
        <div class="card-header">
          <h3>Projects</h3>
        </div>
        ${renderProjectList()}
      </article>
    </section>
  `;
}

function renderGoalsPage() {
  const todayGoals = getTodayGoals();
  const completion = workspaceState.goals.length
    ? Math.round((getCompletedGoals().length / workspaceState.goals.length) * 100)
    : 0;

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Daily planning</span>
        <h2>Goals</h2>
        <p>Break the day into a clear target, supporting tasks, and measurable progress.</p>
      </div>
      <button type="button" class="btn-outline" data-action="add-goal">Add Goal</button>
    </section>

    <section class="metric-grid">
      <article class="dash-card metric-card">
        <span>Today's goals</span>
        <strong>${todayGoals.length}</strong>
        <p>${todayGoals.length ? "Planned for today" : "Ready to plan"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Completion</span>
        <strong>${completion}%</strong>
        <p>${getCompletedGoals().length} completed</p>
      </article>
      <article class="dash-card metric-card">
        <span>Focus time</span>
        <strong>${workspaceState.checkIns.length}</strong>
        <p>Progress check-ins</p>
      </article>
    </section>

    <section class="dash-row-2">
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Goal Board</h3>
          <button type="button" class="btn-add-task" data-action="add-goal">New Task</button>
        </div>
        ${renderGoalList()}
      </article>
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Suggested Structure</h3>
        </div>
        <ul class="template-list">
          <li><strong>Primary outcome</strong><span>The one thing that makes today successful.</span></li>
          <li><strong>Supporting tasks</strong><span>Small work items that move the outcome forward.</span></li>
          <li><strong>End-of-day review</strong><span>A short reflection for tomorrow's plan.</span></li>
        </ul>
      </article>
    </section>
  `;
}

function renderProjectsPage() {
  const latestProject = workspaceState.projects.at(-1);

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Project tracking</span>
        <h2>Projects</h2>
        <p>Organize repositories, goals, and status notes around each active project.</p>
      </div>
      <button type="button" class="btn-outline" data-action="add-project">Add Project</button>
    </section>

    <section class="dash-row-2">
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Tracked Projects</h3>
        </div>
        ${renderProjectList()}
      </article>
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Project Template</h3>
        </div>
        <div class="project-template">
          <div><span>Name</span><strong>${escapeHtml(latestProject?.name || "SprintOps AI")}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(latestProject?.status || "Planning")}</strong></div>
          <div><span>Linked repository</span><strong>${workspaceState.repositories.length ? escapeHtml(workspaceState.repositories[0].name) : "Not connected"}</strong></div>
          <div><span>Next milestone</span><strong>${workspaceState.goals[0] ? escapeHtml(workspaceState.goals[0].title) : "Define first goal"}</strong></div>
        </div>
      </article>
    </section>

    <section class="dash-card template-panel">
      <div class="card-header">
        <h3>Recent Project Activity</h3>
      </div>
      <div class="timeline-empty">
        <span></span>
        <p>Project updates will appear after you connect a repository or create a project goal.</p>
      </div>
    </section>
  `;
}

function renderGitPage() {
  const latestRepository = workspaceState.repositories.at(-1);
  const githubConnection = workspaceState.githubConnection;

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Repository signal</span>
        <h2>Git Activity</h2>
        <p>${githubConnection ? `Connected to GitHub as ${escapeHtml(githubConnection.name || githubConnection.email)}.` : "Connect GitHub to start preparing repository activity tracking."}</p>
      </div>
      <button type="button" class="btn-outline" data-action="connect-github">
        ${githubConnection ? "Reconnect GitHub" : "Connect GitHub"}
      </button>
    </section>

    <section class="metric-grid">
      <article class="dash-card metric-card">
        <span>GitHub status</span>
        <strong>${githubConnection ? "Connected" : "Not connected"}</strong>
        <p>${githubConnection ? `Since ${formatShortDate(githubConnection.connectedAt)}` : "Authorize GitHub first"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Tracked repositories</span>
        <strong>${workspaceState.repositories.length}</strong>
        <p>${workspaceState.repositories.length ? "Repository records" : "Ready after GitHub sync"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Active branch</span>
        <strong>${escapeHtml(latestRepository?.branch || "-")}</strong>
        <p>${latestRepository ? escapeHtml(latestRepository.name) : "Connect a folder first"}</p>
      </article>
    </section>

    <section class="dash-row-2">
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>GitHub Connection</h3>
        </div>
        ${renderRepositoryList()}
      </article>
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Repository Health</h3>
        </div>
        <ul class="template-list">
          <li><strong>Authorization</strong><span>${githubConnection ? "GitHub access is authorized through Supabase." : "Connect GitHub to authorize repository access."}</span></li>
          <li><strong>Commit cadence</strong><span>Measures consistency once repository sync is added.</span></li>
          <li><strong>Branch hygiene</strong><span>Tracks stale branches and uncommitted changes after repositories are synced.</span></li>
        </ul>
      </article>
    </section>
  `;
}

function renderFeedbackPage() {
  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">AI review</span>
        <h2>AI Feedback</h2>
        <p>Turn your work history into concise coaching, blockers, and next-step suggestions.</p>
      </div>
      <button type="button" class="btn-outline" data-action="configure-ai">Configure AI</button>
    </section>

    <section class="dash-row-2">
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Latest Feedback</h3>
        </div>
        ${renderFeedbackContent()}
      </article>
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Review Template</h3>
        </div>
        <ul class="template-list">
          <li><strong>Progress summary</strong><span>What moved forward since the last review.</span></li>
          <li><strong>Risk signals</strong><span>Scope, delay, or quality patterns worth attention.</span></li>
          <li><strong>Suggested next move</strong><span>A focused recommendation for the next session.</span></li>
        </ul>
      </article>
    </section>
  `;
}

function renderAnalyticsPage() {
  const totalGoals = workspaceState.goals.length;
  const completion = totalGoals ? Math.round((getCompletedGoals().length / totalGoals) * 100) : 0;

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Progress metrics</span>
        <h2>Analytics</h2>
        <p>Understand your goal completion, coding rhythm, and consistency over time.</p>
      </div>
      <button type="button" class="btn-outline" data-action="export-report">Export Report</button>
    </section>

    <section class="metric-grid">
      <article class="dash-card metric-card">
        <span>Weekly progress</span>
        <strong>${completion}%</strong>
        <p>${totalGoals ? "Goal completion" : "Add goals to begin"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Work sessions</span>
        <strong>${workspaceState.checkIns.length}</strong>
        <p>Sessions recorded</p>
      </article>
      <article class="dash-card metric-card">
        <span>Momentum</span>
        <strong>${getCurrentStreak() ? "Rising" : "New"}</strong>
        <p>${getCurrentStreak() ? "Current streak active" : "Needs seven days of data"}</p>
      </article>
    </section>

    <section class="dash-card template-panel">
      <div class="card-header">
        <h3>Weekly Trend</h3>
      </div>
      <div class="chart-placeholder" aria-label="Empty weekly analytics chart">
        <span class="chart-bar-1"></span>
        <span class="chart-bar-2"></span>
        <span class="chart-bar-3"></span>
        <span class="chart-bar-4"></span>
        <span class="chart-bar-5"></span>
        <span class="chart-bar-6"></span>
        <span class="chart-bar-7"></span>
      </div>
    </section>
  `;
}

function renderStreaksPage() {
  const checkedDays = new Set(workspaceState.checkIns.map((date) => new Date(date).toDateString()));

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Consistency</span>
        <h2>Streaks</h2>
        <p>Build a visible record of daily progress across goals, commits, and reviews.</p>
      </div>
      <button type="button" class="btn-outline" data-action="log-progress">Log Progress</button>
    </section>

    <section class="metric-grid">
      <article class="dash-card metric-card">
        <span>Current streak</span>
        <strong>${getCurrentStreak()} days</strong>
        <p>${getCurrentStreak() ? "Keep going" : "Start today"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Best streak</span>
        <strong>${getBestStreak()} days</strong>
        <p>${getBestStreak() ? "Personal best" : "No history yet"}</p>
      </article>
      <article class="dash-card metric-card">
        <span>Check-ins</span>
        <strong>${workspaceState.checkIns.length}</strong>
        <p>This month</p>
      </article>
    </section>

    <section class="dash-card template-panel">
      <div class="card-header">
        <h3>Monthly Streak Grid</h3>
      </div>
      <div class="streak-grid" aria-label="Empty monthly streak grid">
        ${Array.from({ length: 35 }, (_, index) => {
          const day = new Date();
          day.setDate(day.getDate() - 34 + index);
          const classes = [
            isToday(day) ? "today" : "",
            checkedDays.has(day.toDateString()) ? "checked" : "",
          ].filter(Boolean).join(" ");

          return `<span class="${classes}" title="${formatShortDate(day)}"></span>`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSettingsPage() {
  const displayName = escapeHtml(dashboardUser?.name || "");
  const email = escapeHtml(dashboardUser?.email || "");

  return `
    <section class="page-hero dash-card">
      <div>
        <span class="page-badge">Workspace controls</span>
        <h2>Settings</h2>
        <p>Manage your profile, notification preferences, and AI configuration.</p>
      </div>
      <button type="button" class="btn-outline" data-action="save-settings">Save Changes</button>
    </section>

    <section class="dash-row-2">
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Profile</h3>
        </div>
        <form class="settings-form" id="settings-form">
          <label>
            <span>Name</span>
            <input type="text" name="name" value="${displayName}" aria-label="Name" />
          </label>
          <label>
            <span>Email</span>
            <input type="email" name="email" value="${email}" aria-label="Email" />
          </label>
        </form>
      </article>
      <article class="dash-card template-panel">
        <div class="card-header">
          <h3>Preferences</h3>
        </div>
        <div class="settings-options">
          <label><input type="checkbox" name="dailyReminders" ${workspaceState.preferences.dailyReminders ? "checked" : ""} /> Daily goal reminders</label>
          <label><input type="checkbox" name="weeklySummary" ${workspaceState.preferences.weeklySummary ? "checked" : ""} /> Weekly progress summary</label>
          <label><input type="checkbox" name="aiAfterSession" ${workspaceState.preferences.aiAfterSession ? "checked" : ""} /> AI feedback after each session</label>
        </div>
      </article>
    </section>
  `;
}

const PAGE_RENDERERS = {
  dashboard: renderDashboardPage,
  goals: renderGoalsPage,
  projects: renderProjectsPage,
  git: renderGitPage,
  feedback: renderFeedbackPage,
  analytics: renderAnalyticsPage,
  streaks: renderStreaksPage,
  settings: renderSettingsPage,
};

function addGoal() {
  const title = window.prompt("Goal title");
  if (!title?.trim()) return;

  workspaceState.goals.unshift({
    id: createId("goal"),
    title: title.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  });
  saveWorkspaceState();
  renderPage("goals");
}

function addProject() {
  const name = window.prompt("Project name");
  if (!name?.trim()) return;

  workspaceState.projects.unshift({
    id: createId("project"),
    name: name.trim(),
    status: "Planning",
    createdAt: new Date().toISOString(),
  });
  saveWorkspaceState();
  renderPage("projects");
}

async function connectGitHub() {
  try {
    const api = window.jarvis?.api;
    if (!api?.signInWithGitHub) {
      throw new Error("GitHub auth bridge unavailable. Restart the app.");
    }

    const githubUser = await api.signInWithGitHub();

    workspaceState.githubConnection = {
      id: githubUser.id,
      name: githubUser.name,
      email: githubUser.email,
      avatarUrl: githubUser.avatarUrl,
      connectedAt: new Date().toISOString(),
    };

    saveWorkspaceState();
    renderPage("git");
  } catch (error) {
    window.alert(error.message);
  }
}

function configureAi() {
  workspaceState.aiEnabled = !workspaceState.aiEnabled;
  saveWorkspaceState();
  renderPage("feedback");
}

function logProgress() {
  if (!workspaceState.checkIns.some(isToday)) {
    workspaceState.checkIns.push(new Date().toISOString());
    saveWorkspaceState();
  }

  renderPage("streaks");
}

function exportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    goals: workspaceState.goals,
    projects: workspaceState.projects,
    repositories: workspaceState.repositories,
    checkIns: workspaceState.checkIns,
  };

  console.info("SprintOps AI workspace report", report);
  window.alert("Report data was written to the developer console.");
}

function saveSettings() {
  const form = document.getElementById("settings-form");
  if (!form) return;

  const formData = new FormData(form);
  const options = document.querySelector(".settings-options");

  dashboardUser = {
    ...dashboardUser,
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
  };
  workspaceState.preferences = {
    dailyReminders: Boolean(options?.querySelector('[name="dailyReminders"]')?.checked),
    weeklySummary: Boolean(options?.querySelector('[name="weeklySummary"]')?.checked),
    aiAfterSession: Boolean(options?.querySelector('[name="aiAfterSession"]')?.checked),
  };

  localStorage.setItem("jarvis.rememberedUser", JSON.stringify(dashboardUser));
  saveWorkspaceState();
  syncUserChrome();
  renderPage("settings");
}

function handleDashboardAction(event) {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;

  const { action, id } = actionElement.dataset;

  if (action === "add-goal") addGoal();
  if (action === "add-project") addProject();
  if (action === "connect-github") connectGitHub();
  if (action === "configure-ai") configureAi();
  if (action === "log-progress") logProgress();
  if (action === "export-report") exportReport();
  if (action === "save-settings") saveSettings();

  if (action === "toggle-goal") {
    const goal = workspaceState.goals.find((item) => item.id === id);
    if (goal) {
      goal.done = actionElement.checked;
      saveWorkspaceState();
      renderPage(activePage);
    }
  }

  if (action === "delete-goal") {
    workspaceState.goals = workspaceState.goals.filter((item) => item.id !== id);
    saveWorkspaceState();
    renderPage(activePage);
  }

  if (action === "delete-project") {
    workspaceState.projects = workspaceState.projects.filter((item) => item.id !== id);
    saveWorkspaceState();
    renderPage(activePage);
  }

  if (action === "delete-repository") {
    workspaceState.repositories = workspaceState.repositories.filter((item) => item.id !== id);
    saveWorkspaceState();
    renderPage(activePage);
  }

  if (action === "disconnect-github") {
    workspaceState.githubConnection = null;
    workspaceState.repositories = [];
    saveWorkspaceState();
    renderPage(activePage);
  }
}

function preventPlaceholderActions() {
  document.querySelectorAll("#dashboard-view a[href='#']").forEach((link) => {
    if (link.dataset.bound === "true") return;

    link.dataset.bound = "true";
    link.addEventListener("click", (event) => event.preventDefault());
  });

  document.querySelectorAll(".btn-outline, .btn-add-task, .empty-state-action").forEach((button) => {
    if (button.dataset.blurBound === "true") return;

    button.dataset.blurBound = "true";
    button.addEventListener("click", () => {
      button.blur();
    });
  });
}

function renderPage(page) {
  const nextPage = PAGE_RENDERERS[page] ? page : "dashboard";
  const content = document.getElementById("dash-content");
  const title = document.getElementById("dash-page-title");

  activePage = nextPage;
  title.textContent = PAGE_TITLES[nextPage];
  content.innerHTML = PAGE_RENDERERS[nextPage]();

  document.querySelectorAll(".dash-nav-item").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.page === nextPage);
  });

  renderEmptyStates();
  preventPlaceholderActions();
}

function bindDashboardNavigation() {
  document.querySelectorAll(".dash-nav-item").forEach((item) => {
    if (item.dataset.bound === "true") return;

    item.dataset.bound = "true";
    item.addEventListener("click", () => {
      renderPage(item.dataset.page);
    });
  });
}

function bindDashboardActions() {
  const dashboard = document.getElementById("dashboard-view");
  if (dashboard.dataset.actionsBound === "true") return;

  dashboard.dataset.actionsBound = "true";
  dashboard.addEventListener("click", handleDashboardAction);
  dashboard.addEventListener("change", handleDashboardAction);
  dashboard.addEventListener("submit", (event) => {
    event.preventDefault();

    if (event.target.id === "settings-form") {
      saveSettings();
    }
  });
}

function syncUserChrome() {
  const initials = getInitials(dashboardUser.name, dashboardUser.email);
  const displayName = dashboardUser.name || dashboardUser.email;

  document.getElementById("sidebar-avatar").textContent = initials;
  document.getElementById("sidebar-name").textContent = displayName;
  document.getElementById("sidebar-email").textContent = dashboardUser.email;
  document.getElementById("dash-date").textContent = formatHeaderDate(new Date());
}

function initDashboard(user) {
  dashboardUser = user;
  loadWorkspaceState();
  syncGitHubConnectionFromUser();
  syncUserChrome();

  bindDashboardNavigation();
  bindDashboardActions();
  renderPage(activePage);
}

window.initDashboard = initDashboard;
