(function () {
  const runtime = window.ProxyAuthRuntime;
  if (!runtime) {
    console.error("ProxyAuthRuntime is not available for user-management embed.");
    return;
  }

  runtime.registerEmbed("user-management", function ({ shadowRoot, data, config }) {
    const surface = runtime.createSurface(shadowRoot, "proxy-surface--dark");
    const panel = document.createElement("section");
    panel.className = "um-panel";
    panel.innerHTML = `
      <header class="um-header">
        <div>
          <h2 class="um-title">Invite Team Members</h2>
          <p class="um-subtitle">View all members in your project and invite new ones. Assign roles and manage access for secure collaboration.</p>
        </div>
        <div class="um-controls">
          <input type="text" placeholder="Search User" class="um-search" data-action="search-input" />
          <button type="button" class="um-add-btn" data-action="add-user">Add User</button>
        </div>
      </header>
      <div class="um-member-list">
        ${data.teamMembers
          .map(
            (member) => `
              <article class="um-member" data-member-id="${member.id}">
                <div class="um-avatar">${escapeHtml(runtime.getInitials(member.name))}</div>
                <div>
                  <div class="um-user-primary">${escapeHtml(member.name)}</div>
                  <div class="um-user-secondary">${escapeHtml(member.email)}</div>
                </div>
                <div class="um-actions">
                  <span class="um-role">${escapeHtml(member.role)}</span>
                  <button class="um-icon-btn" type="button" data-action="edit-user" data-member-id="${member.id}" aria-label="Edit user ${escapeHtml(member.name)}">&#9998;</button>
                  <button class="um-icon-btn" type="button" data-action="remove-user" data-member-id="${member.id}" aria-label="Remove user ${escapeHtml(member.name)}">&#128465;</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
    surface.appendChild(panel);
    bindEvents(panel, data, config);
  });

  function bindEvents(panel, data, config) {
    const addButton = panel.querySelector('[data-action="add-user"]');
    if (addButton) {
      addButton.addEventListener("click", function () {
        runtime.invokeCallback(config && config.success, { type: "add-user" });
      });
    }

    const searchInput = panel.querySelector('[data-action="search-input"]');
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        filterMembers(panel, searchInput.value);
      });
    }

    panel.querySelectorAll('[data-action="edit-user"]').forEach(function (button) {
      button.addEventListener("click", function () {
        const member = findMember(button.getAttribute("data-member-id"), data);
        if (member) {
          runtime.invokeCallback(config && config.success, { type: "edit-user", member });
        }
      });
    });

    panel.querySelectorAll('[data-action="remove-user"]').forEach(function (button) {
      button.addEventListener("click", function () {
        const member = findMember(button.getAttribute("data-member-id"), data);
        if (member) {
          runtime.invokeCallback(config && config.success, { type: "remove-user", member });
        }
      });
    });
  }

  function filterMembers(panel, query) {
    const normalized = query.trim().toLowerCase();
    panel.querySelectorAll(".um-member").forEach(function (row) {
      const text = row.textContent || "";
      row.style.display = !normalized || text.toLowerCase().includes(normalized) ? "grid" : "none";
    });
  }

  function findMember(id, data) {
    if (!id) {
      return null;
    }
    return data.teamMembers.find(function (member) {
      return String(member.id) === String(id);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
