(function () {
  const runtime = window.ProxyAuthRuntime;
  if (!runtime) {
    console.error("ProxyAuthRuntime is not available for user-details embed.");
    return;
  }

  runtime.registerEmbed("user-details", function ({ shadowRoot, data, config }) {
    const surface = runtime.createSurface(shadowRoot);

    const clientPanel = document.createElement("section");
    clientPanel.className = "panel";
    clientPanel.innerHTML = `
      <h2>Client Details</h2>
      <form class="client-form" novalidate>
        <label>
          Name *
          <input name="name" value="${escapeHtml(data.client.name)}" autocomplete="off" />
        </label>
        <label>
          Mobile
          <input name="mobile" value="${escapeHtml(data.client.mobile)}" autocomplete="off" />
        </label>
        <label>
          Email
          <input name="email" type="email" value="${escapeHtml(data.client.email)}" autocomplete="off" />
        </label>
        <button type="submit" class="primary-btn">Update</button>
      </form>
    `;
    surface.appendChild(clientPanel);

    const companyPanel = document.createElement("section");
    companyPanel.className = "panel";
    companyPanel.innerHTML = `
      <h3>Company Details</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Company Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.companies
              .map(
                (company, index) => `
                  <tr data-company-id="${company.id}">
                    <td data-label="S.No.">${index + 1}</td>
                    <td data-label="Company Name">${escapeHtml(company.name)}</td>
                    <td data-label="Action">
                      ${
                        company.isCurrent
                          ? '<span class="current-pill">Current Company</span>'
                          : `<button type="button" class="leave-btn" data-company-id="${company.id}">Leave</button>`
                      }
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    surface.appendChild(companyPanel);

    bindClientFormEvents(surface, config);
    bindLeaveEvents(surface, data, config);
  });

  function bindClientFormEvents(surface, config) {
    const form = surface.querySelector(".client-form");
    if (!form) {
      return;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {
        name: (formData.get("name") || "").toString().trim(),
        mobile: (formData.get("mobile") || "").toString().trim(),
        email: (formData.get("email") || "").toString().trim(),
      };
      runtime.invokeCallback(config && config.success, {
        type: "update",
        values: payload,
      });
    });
  }

  function bindLeaveEvents(surface, data, config) {
    const buttons = surface.querySelectorAll(".leave-btn");
    buttons.forEach(function (button) {
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
