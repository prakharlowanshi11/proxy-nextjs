(function () {
  const runtime = window.ProxyAuthRuntime;
  if (!runtime) {
    console.error("ProxyAuthRuntime is not available for member-summary embed.");
    return;
  }

  runtime.registerEmbed("member-summary", function ({ shadowRoot, data, config }) {
    const surface = runtime.createSurface(shadowRoot);
    const summary = computeSummary(data);
    const panel = document.createElement("section");
    panel.className = "summary-card";
    panel.innerHTML = `
      <div class="summary-header">${escapeHtml(data.client.name)}</div>
      <div class="summary-meta">${escapeHtml(data.client.email)} • ${escapeHtml(data.client.mobile)}</div>
      <div class="summary-stat-group">
        <div class="summary-stat">
          <div class="summary-stat-label">Total Companies</div>
          <div class="summary-stat-value">${summary.totalCompanies}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Active Company</div>
          <div class="summary-stat-value" style="font-size:18px;">${escapeHtml(summary.currentCompany)}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Membership Age</div>
          <div class="summary-stat-value">${summary.membershipAge} yrs</div>
        </div>
      </div>
      <div>
        <button type="button" class="summary-primary" data-action="manage-companies">Manage Companies</button>
        <button type="button" class="summary-secondary" data-action="refresh-data">Refresh</button>
      </div>
    `;
    surface.appendChild(panel);

    const manageBtn = panel.querySelector('[data-action="manage-companies"]');
    if (manageBtn) {
      manageBtn.addEventListener("click", function () {
        runtime.invokeCallback(config && config.success, {
          type: "navigate",
          target: "companies",
        });
      });
    }

    const refreshBtn = panel.querySelector('[data-action="refresh-data"]');
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        runtime.invokeCallback(config && config.success, { type: "refresh" });
      });
    }
  });

  function computeSummary(data) {
    const active = data.companies.find(function (company) {
      return company.isCurrent;
    });
    return {
      totalCompanies: data.companies.length,
      currentCompany: active ? active.name : "Not Assigned",
      membershipAge: 3,
    };
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
