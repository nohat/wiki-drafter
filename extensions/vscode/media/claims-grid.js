(function () {
  const vscode = acquireVsCodeApi();
  let currentClaims = [];

  // DOM elements
  const statusFilter = document.getElementById("statusFilter");
  const riskFilter = document.getElementById("riskFilter");
  const typeFilter = document.getElementById("typeFilter");
  const container = document.getElementById("claims-container");

  // Event listeners
  statusFilter.addEventListener("change", handleFilterChange);
  riskFilter.addEventListener("change", handleFilterChange);
  typeFilter.addEventListener("change", handleFilterChange);

  // Message handler
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("Claims Grid Webview: Received message:", message.type, message);

    switch (message.type) {
      case "updateClaims":
        updateClaims(message.claims);
        break;
    }
  });

  function updateClaims(claims) {
    console.log("Claims Grid Webview: updateClaims called with", claims.length, "claims");
    currentClaims = claims;
    renderClaims(claims);
  }

  function renderClaims(claims) {
    console.log("Claims Grid Webview: renderClaims called with", claims.length, "claims");
    container.innerHTML = "";

    if (claims.length === 0) {
      console.log("Claims Grid Webview: No claims to display");
      container.innerHTML = '<div class="no-claims">No claims found</div>';
      return;
    }

    const table = document.createElement("table");
    table.className = "claims-table";

    // Header
    const header = document.createElement("thead");
    header.innerHTML = `
            <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Claim</th>
                <th>Section</th>
                <th>Sources</th>
            </tr>
        `;
    table.appendChild(header);

    // Body
    const tbody = document.createElement("tbody");
    claims.forEach((claim) => {
      const row = createClaimRow(claim);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }

  function createClaimRow(claim) {
    const row = document.createElement("tr");
    row.className = "claim-row";
    row.dataset.claimId = claim.id;

    // Status pill
    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `status-pill status-${claim.status}`;
    statusPill.textContent = claim.status;
    statusCell.appendChild(statusPill);

    // Type badge
    const typeCell = document.createElement("td");
    const typeBadge = document.createElement("span");
    typeBadge.className = `type-badge type-${claim.type}`;
    typeBadge.textContent = claim.type;
    typeCell.appendChild(typeBadge);

    // Risk indicator
    const riskCell = document.createElement("td");
    const riskIndicator = document.createElement("span");
    riskIndicator.className = `risk-indicator risk-${claim.risk}`;
    riskIndicator.textContent = claim.risk;
    riskCell.appendChild(riskIndicator);

    // Claim text (truncated)
    const claimCell = document.createElement("td");
    claimCell.className = "claim-text";
    claimCell.textContent = truncateText(claim.text, 80);
    claimCell.title = claim.text;

    // Section
    const sectionCell = document.createElement("td");
    sectionCell.className = "section";
    sectionCell.textContent = claim.section;

    // Sources
    const sourcesCell = document.createElement("td");
    sourcesCell.className = "sources";
    if (claim.sources.length > 0) {
      const sourceCount = document.createElement("span");
      sourceCount.className = "source-count";
      sourceCount.textContent = `${claim.sources.length} source${claim.sources.length > 1 ? "s" : ""}`;
      sourcesCell.appendChild(sourceCount);

      if (claim.source_quality) {
        const qualityScore = document.createElement("span");
        qualityScore.className = "quality-score";
        qualityScore.textContent = `${claim.source_quality}%`;
        sourcesCell.appendChild(qualityScore);
      }
    } else {
      sourcesCell.innerHTML = '<span class="no-sources">No sources</span>';
    }

    row.appendChild(statusCell);
    row.appendChild(typeCell);
    row.appendChild(riskCell);
    row.appendChild(claimCell);
    row.appendChild(sectionCell);
    row.appendChild(sourcesCell);

    // Click handler
    row.addEventListener("click", () => {
      selectClaim(claim.id);
    });

    return row;
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function selectClaim(claimId) {
    // Remove previous selection
    const previouslySelected = container.querySelector(".claim-row.selected");
    if (previouslySelected) {
      previouslySelected.classList.remove("selected");
    }

    // Select new row
    const row = container.querySelector(`[data-claim-id="${claimId}"]`);
    if (row) {
      row.classList.add("selected");
    }

    // Notify VS Code
    vscode.postMessage({
      type: "claimSelected",
      claimId: claimId,
    });
  }

  function handleFilterChange() {
    const filter = {
      status: statusFilter.value,
      risk: riskFilter.value,
      type: typeFilter.value,
    };

    vscode.postMessage({
      type: "filterChanged",
      filter: filter,
    });
  }

  // Notify that webview is ready
  vscode.postMessage({ type: "ready" });
})();
