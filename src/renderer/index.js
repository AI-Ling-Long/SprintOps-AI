const loginView = document.getElementById("login-view");
const signupView = document.getElementById("signup-view");
const dashboardView = document.getElementById("dashboard-view");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const addUserForm = document.getElementById("add-user-form");

const loginMessage = document.getElementById("login-message");
const signupMessage = document.getElementById("signup-message");
const dashboardMessage = document.getElementById("dashboard-message");
const dashboardGreeting = document.getElementById("dashboard-greeting");
const usersTableBody = document.getElementById("users-table-body");

const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");
const iconShow = togglePasswordBtn.querySelector(".icon-show");
const iconHide = togglePasswordBtn.querySelector(".icon-hide");

let currentUser = null;

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.hidden = false;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", !isError);
}

function clearMessage(element) {
  element.hidden = true;
  element.textContent = "";
}

function showView(view) {
  loginView.hidden = view !== "login";
  signupView.hidden = view !== "signup";
  dashboardView.hidden = view !== "dashboard";
}

function ensureApi() {
  if (!window.jarvis?.api) {
    throw new Error("API bridge unavailable. Restart the app.");
  }
  return window.jarvis.api;
}

async function loadUsers() {
  const api = ensureApi();
  const users = await api.getUsers();

  if (!users.length) {
    usersTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-row">No users yet.</td></tr>';
    return;
  }

  usersTableBody.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${user.id}</td>
          <td>${escapeHtml(user.name || "—")}</td>
          <td>${escapeHtml(user.email || "—")}</td>
          <td>
            <button type="button" class="btn btn-danger btn-small" data-delete-id="${user.id}">
              Delete
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  usersTableBody.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => handleDeleteUser(button.dataset.deleteId));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function openDashboard(user) {
  currentUser = user;
  dashboardGreeting.textContent = `Signed in as ${user.name || user.email}`;
  clearMessage(dashboardMessage);
  showView("dashboard");

  try {
    await loadUsers();
  } catch (error) {
    showMessage(dashboardMessage, error.message, true);
  }
}

async function handleDeleteUser(id) {
  clearMessage(dashboardMessage);

  try {
    const api = ensureApi();
    await api.deleteUser(id);
    showMessage(dashboardMessage, "User deleted.", false);
    await loadUsers();
  } catch (error) {
    showMessage(dashboardMessage, error.message, true);
  }
}

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  iconShow.hidden = isHidden;
  iconHide.hidden = !isHidden;
  togglePasswordBtn.setAttribute(
    "aria-label",
    isHidden ? "Hide password" : "Show password"
  );
});

document.getElementById("show-signup").addEventListener("click", (event) => {
  event.preventDefault();
  clearMessage(loginMessage);
  clearMessage(signupMessage);
  showView("signup");
});

document.getElementById("show-login").addEventListener("click", (event) => {
  event.preventDefault();
  clearMessage(loginMessage);
  clearMessage(signupMessage);
  showView("login");
});

document.getElementById("logout-btn").addEventListener("click", () => {
  currentUser = null;
  loginForm.reset();
  clearMessage(dashboardMessage);
  showView("login");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(loginMessage);

  const formData = new FormData(loginForm);

  try {
    const api = ensureApi();
    const user = await api.login({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    await openDashboard(user);
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(signupMessage);

  const formData = new FormData(signupForm);

  try {
    const api = ensureApi();
    await api.createUser({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    showMessage(signupMessage, "Account created. You can log in now.", false);
    signupForm.reset();
    setTimeout(() => showView("login"), 1200);
  } catch (error) {
    showMessage(signupMessage, error.message, true);
  }
});

addUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(dashboardMessage);

  const formData = new FormData(addUserForm);

  try {
    const api = ensureApi();
    await api.createUser({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    addUserForm.reset();
    showMessage(dashboardMessage, "User added.", false);
    await loadUsers();
  } catch (error) {
    showMessage(dashboardMessage, error.message, true);
  }
});

document.querySelectorAll('a[href="#"]:not(#show-signup):not(#show-login)').forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

showView("login");
