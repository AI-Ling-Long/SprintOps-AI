const authShell = document.getElementById("auth-shell");
const loginView = document.getElementById("login-view");
const signupView = document.getElementById("signup-view");
const dashboardView = document.getElementById("dashboard-view");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const rememberInput = loginForm.elements.remember;
const githubLoginBtn = document.getElementById("github-login-btn");
const googleLoginBtn = document.getElementById("google-login-btn");

const loginMessage = document.getElementById("login-message");
const signupMessage = document.getElementById("signup-message");

const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");
const iconShow = togglePasswordBtn.querySelector(".icon-show");
const iconHide = togglePasswordBtn.querySelector(".icon-hide");
const signupPasswordInput = document.getElementById("signup-password");
const toggleSignupPasswordBtn = document.getElementById("toggle-signup-password");

let currentUser = null;
const rememberedUserKey = "jarvis.rememberedUser";
const oauthButtons = {
  github: githubLoginBtn,
  google: googleLoginBtn,
};
const oauthButtonLabels = {
  github: "GitHub",
  google: "Google",
};
const oauthButtonContent = {
  github: githubLoginBtn.innerHTML,
  google: googleLoginBtn.innerHTML,
};

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
  const isDashboard = view === "dashboard";

  authShell.hidden = isDashboard;
  dashboardView.hidden = !isDashboard;
  loginView.hidden = view !== "login";
  signupView.hidden = view !== "signup";
}

function ensureApi() {
  if (!window.jarvis?.api) {
    throw new Error("API bridge unavailable. Restart the app.");
  }

  return window.jarvis.api;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function readFormField(formData, fieldName, { trim = true } = {}) {
  const value = String(formData.get(fieldName) ?? "");
  return trim ? value.trim() : value;
}

function validateUserPayload({ name, email, password }) {
  if (!name) return "Name is required.";
  if (!email) return "Email is required.";
  if (!isValidEmail(email)) return "Enter a valid email address.";
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";

  return null;
}

async function openDashboard(user) {
  currentUser = user;
  showView("dashboard");

  if (typeof window.initDashboard === "function") {
    window.initDashboard(user);
  }
}

function rememberUser(user) {
  localStorage.setItem(rememberedUserKey, JSON.stringify(user));
}

function forgetUser() {
  localStorage.removeItem(rememberedUserKey);
}

function getRememberedUser() {
  try {
    const rawUser = localStorage.getItem(rememberedUserKey);
    if (!rawUser) return null;

    const user = JSON.parse(rawUser);
    if (!user || typeof user !== "object" || !user.email) return null;

    return user;
  } catch {
    forgetUser();
    return null;
  }
}

function togglePasswordVisibility(input, button) {
  const isHidden = input.type === "password";
  const showIcon = button.querySelector(".icon-show");
  const hideIcon = button.querySelector(".icon-hide");

  input.type = isHidden ? "text" : "password";
  showIcon.hidden = isHidden;
  hideIcon.hidden = !isHidden;
  button.setAttribute(
    "aria-label",
    isHidden ? "Hide password" : "Show password"
  );
}

function showSignup(event) {
  event.preventDefault();
  clearMessage(loginMessage);
  clearMessage(signupMessage);
  showView("signup");
}

function showLogin(event) {
  event.preventDefault();
  clearMessage(loginMessage);
  clearMessage(signupMessage);
  showView("login");
}

async function logout() {
  currentUser = null;
  forgetUser();
  loginForm.reset();
  showView("login");

  try {
    await ensureApi().signOut?.();
  } catch (error) {
    console.warn("Supabase sign-out failed", error);
  }
}

async function submitLogin(event) {
  event.preventDefault();
  clearMessage(loginMessage);

  if (!loginForm.reportValidity()) return;

  const formData = new FormData(loginForm);
  const payload = {
    email: readFormField(formData, "email"),
    password: readFormField(formData, "password", { trim: false }),
  };

  if (!isValidEmail(payload.email)) {
    showMessage(loginMessage, "Enter a valid email address.", true);
    return;
  }

  try {
    const api = ensureApi();
    const user = await api.login(payload);

    if (rememberInput.checked) {
      rememberUser(user);
    } else {
      forgetUser();
    }

    await openDashboard(user);
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  }
}

async function submitSignup(event) {
  event.preventDefault();
  clearMessage(signupMessage);

  if (!signupForm.reportValidity()) return;

  const formData = new FormData(signupForm);
  const payload = {
    name: readFormField(formData, "name"),
    email: readFormField(formData, "email"),
    password: readFormField(formData, "password", { trim: false }),
  };

  const validationError = validateUserPayload(payload);

  if (validationError) {
    showMessage(signupMessage, validationError, true);
    return;
  }

  try {
    const api = ensureApi();

    const createdUser = await api.createUser(payload);
    const message = createdUser.requiresEmailConfirmation
      ? "Account created. Check your email to confirm it, then log in."
      : "Account created. You can log in now.";

    showMessage(signupMessage, message, false);
    signupForm.reset();

    if (!createdUser.requiresEmailConfirmation) {
      setTimeout(() => showView("login"), 1200);
    }
  } catch (error) {
    showMessage(signupMessage, error.message, true);
  }
}

function setOAuthButtonsDisabled(isDisabled, activeProvider) {
  Object.entries(oauthButtons).forEach(([provider, button]) => {
    button.disabled = isDisabled;

    if (isDisabled && provider === activeProvider) {
      button.textContent = `Waiting for ${oauthButtonLabels[provider]}...`;
    }

    if (!isDisabled) {
      button.innerHTML = oauthButtonContent[provider];
    }
  });
}

async function signInWithOAuth(provider) {
  clearMessage(loginMessage);

  try {
    const api = ensureApi();
    setOAuthButtonsDisabled(true, provider);

    const user = provider === "github"
      ? await api.signInWithGitHub()
      : await api.signInWithGoogle();

    rememberUser(user);
    await openDashboard(user);
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  } finally {
    setOAuthButtonsDisabled(false);
  }
}

function preventPlaceholderLinks() {
  document
    .querySelectorAll('#auth-shell a[href="#"]:not(#show-signup):not(#show-login)')
    .forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault());
    });
}

togglePasswordBtn.addEventListener("click", () => togglePasswordVisibility(passwordInput, togglePasswordBtn));
toggleSignupPasswordBtn.addEventListener("click", () => togglePasswordVisibility(signupPasswordInput, toggleSignupPasswordBtn));
document.getElementById("show-signup").addEventListener("click", showSignup);
document.getElementById("show-login").addEventListener("click", showLogin);
document.getElementById("logout-btn").addEventListener("click", logout);
githubLoginBtn.addEventListener("click", () => signInWithOAuth("github"));
googleLoginBtn.addEventListener("click", () => signInWithOAuth("google"));
loginForm.addEventListener("submit", submitLogin);
signupForm.addEventListener("submit", submitSignup);

preventPlaceholderLinks();

const rememberedUser = getRememberedUser();

if (rememberedUser) {
  rememberInput.checked = true;
  openDashboard(rememberedUser);
} else {
  showView("login");
}
