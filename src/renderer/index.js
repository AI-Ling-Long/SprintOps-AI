const statusEl = document.getElementById("status");
const versionsEl = document.getElementById("versions");

if (window.jarvis) {
  statusEl.textContent = `Running on ${window.jarvis.platform}`;

  const { node, chrome, electron } = window.jarvis.versions;
  versionsEl.innerHTML = `
    <dt>Node</dt><dd>${node}</dd>
    <dt>Chromium</dt><dd>${chrome}</dd>
    <dt>Electron</dt><dd>${electron}</dd>
  `;
  versionsEl.hidden = false;
} else {
  statusEl.textContent = "Preload bridge unavailable.";
}
