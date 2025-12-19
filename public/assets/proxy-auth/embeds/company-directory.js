(function () {
  const runtime = window.ProxyAuthRuntime;
  if (!runtime) {
    console.error("ProxyAuthRuntime is not available for company-directory embed.");
    return;
  }

  runtime.registerEmbed("company-directory", function ({ shadowRoot, data, config }) {
    const surface = runtime.createSurface(shadowRoot);
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = `
      <h2>Company Directory</h2>
      <p style="color:#6b7280;margin:0;">Explore the organizations linked with your proxy account.</p>
      <div class="company-grid">
        ${data.companies
          .map(
            (company, index) => `
              <article class="company-card${company.isCurrent ? " current" : ""}" data-company-id="${company.id}">
                <div class="company-rank">${index + 1}</div>
                <div class="company-name">${escapeHtml(company.name)}</div>
                <div class="company-meta">Joined • ${runtime.formatJoinedDate(index)}</div>
                <div>
                  ${
                    company.isCurrent
                      ? '<span class="current-pill">Current Company</span>'
                      : `<button type="button" class="leave-btn" data-company-id="${company.id}">Leave</button>`
                  }
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
    surface.appendChild(panel);
    bindLeaveEvents(panel, data, config);
  });

  function bindLeaveEvents(panel, data, config) {
    panel.querySelectorAll(".leave-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const companyId = button.getAttribute("data-company-id");
        const company = data.companies.find(function (entry) {
          return String(entry.id) === String(companyId);
        });
        if (!company) {
          return;
        }
        runtime.invokeCallback(config && config.success, {
          type: "leave",
          company: company,
        });
      });
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
