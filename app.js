(function () {
  "use strict";

  var STORAGE_KEY = "projectFeedbackTracker.data.v2";
  var SETTINGS_KEY = "projectFeedbackTracker.aiSettings";
  var GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

  var ITEM_SECTIONS = {
    risks: { label: "Risk", listLabel: "Risks", printHeading: "Risks" },
    onHold: { label: "On Hold Item", listLabel: "On Hold", printHeading: "On Hold" },
    itRequests: { label: "IT Support Request", listLabel: "IT Support Requests", printHeading: "Support Requests Opened to IT" },
    powerBi: { label: "Power BI Help Desk Request", listLabel: "Power BI Help Desk", printHeading: "Open Help Desk Requests - Power BI Department" }
  };

  var ITEM_SECTION_KEYS = ["risks", "onHold", "itRequests", "powerBi"];

  var state = {
    data: { projects: [], risks: [], onHold: [], itRequests: [], powerBi: [] }
  };

  function emptyData() {
    return { projects: [], risks: [], onHold: [], itRequests: [], powerBi: [] };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      state.data = Object.assign(emptyData(), parsed || {});
    } catch (e) {
      console.error("Failed to load saved data", e);
      state.data = emptyData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function findProject(id) {
    return state.data.projects.find(function (p) { return p.id === id; });
  }

  function projectDisplayName(p) {
    var name = p.name || "Untitled Project";
    return p.shortcode ? "[" + p.shortcode + "] " + name : name;
  }

  // Report/print headings use the project name only, without the shortcode prefix.
  function projectReportName(p) {
    return p.name || "Untitled Project";
  }

  function linesToArray(text) {
    return (text || "")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  // ---- Persistence + "Saved" stamp ----
  // Every edit writes straight to localStorage — there is no Save button.

  var saveStampEl = document.getElementById("saveStamp");
  var saveStampTimer = null;

  function persist() {
    saveData();
    saveStampEl.textContent = "✓ Saved";
    saveStampEl.classList.add("visible");
    clearTimeout(saveStampTimer);
    saveStampTimer = setTimeout(function () { saveStampEl.classList.remove("visible"); }, 1500);
  }

  // ---- Single-screen inline editor ----

  var listEls = {
    projects: document.getElementById("list-projects"),
    risks: document.getElementById("list-risks"),
    onHold: document.getElementById("list-onHold"),
    itRequests: document.getElementById("list-itRequests"),
    powerBi: document.getElementById("list-powerBi")
  };
  var reportViewEl = document.getElementById("reportView");
  var ownerOptionsEl = document.getElementById("ownerOptions");

  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = (ta.scrollHeight + 2) + "px";
  }

  function makeInput(className, placeholder, value) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = className;
    input.placeholder = placeholder;
    input.value = value || "";
    return input;
  }

  function touch(record) {
    record.updatedAt = nowIso();
    persist();
    queueReportRefresh();
  }

  function buildProjectCard(p) {
    var card = document.createElement("div");
    card.className = "pcard";
    card.title = p.updatedAt ? "Updated " + formatDate(p.updatedAt) : "";

    function syncAccent() {
      card.classList.toggle("is-risk", !!p.flagRisk);
      card.classList.toggle("is-hold", !p.flagRisk && !!p.flagOnHold);
      card.classList.toggle("is-hl", !p.flagRisk && !p.flagOnHold && !!p.flagHighlight);
    }
    syncAccent();

    var top = document.createElement("div");
    top.className = "pcard-top";

    var ownerInput = makeInput("f-owner", "Owner", p.owner);
    ownerInput.setAttribute("list", "ownerOptions");
    var nameInput = makeInput("f-name", "Project name", p.name);
    var codeInput = makeInput("f-code", "Code", p.shortcode);

    ownerInput.addEventListener("input", function () { p.owner = ownerInput.value.trim(); touch(p); });
    nameInput.addEventListener("input", function () { p.name = nameInput.value.trim(); touch(p); });
    codeInput.addEventListener("input", function () { p.shortcode = codeInput.value.trim().toUpperCase(); touch(p); });

    function makeChip(label, title, flagKey) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = label;
      chip.title = title;
      function sync() { chip.classList.toggle("on-" + flagKey, !!p[flagKey]); }
      sync();
      chip.addEventListener("click", function () {
        p[flagKey] = !p[flagKey];
        sync();
        syncAccent();
        touch(p);
      });
      return chip;
    }

    var chips = document.createElement("div");
    chips.className = "pcard-chips";
    chips.appendChild(makeChip("⭐ Highlight", "Feature in Key Highlights on the report", "flagHighlight"));
    chips.appendChild(makeChip("⚠️ Risk", "Move this project to the Risks section of the report", "flagRisk"));
    chips.appendChild(makeChip("⏸ Hold", "Move this project to the On Hold section of the report", "flagOnHold"));

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-x";
    delBtn.textContent = "✕";
    delBtn.title = "Delete project";
    delBtn.addEventListener("click", function () {
      if (!confirm('Delete project "' + (p.name || "Untitled Project") +
        '"? Linked risk/on-hold/request items will keep their text but lose the project link. This cannot be undone.')) return;
      state.data.projects = state.data.projects.filter(function (x) { return x.id !== p.id; });
      ITEM_SECTION_KEYS.forEach(function (section) {
        state.data[section].forEach(function (item) {
          if (item.projectId === p.id) item.projectId = "";
        });
      });
      persist();
      rebuildAll();
    });

    top.appendChild(ownerInput);
    top.appendChild(nameInput);
    top.appendChild(codeInput);
    top.appendChild(chips);
    top.appendChild(delBtn);

    var detailRow = document.createElement("div");
    detailRow.className = "pcard-detail";

    var ta = document.createElement("textarea");
    ta.rows = 1;
    ta.placeholder = "Status update — each line becomes its own bullet on the report";
    ta.value = p.detail || "";
    ta.addEventListener("input", function () {
      p.detail = ta.value;
      autoGrow(ta);
      touch(p);
    });

    var aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "btn-ai";
    aiBtn.textContent = "✨";
    aiBtn.title = "AI rewrite this status update";
    aiBtn.addEventListener("click", function () {
      var prompt = buildRewritePrompt("Latest Feedback / Status Caption", p.name || "", projectFlagContext(p), true);
      runRewriteGeneric(aiBtn, prompt, ta.value, function (v) {
        p.detail = v;
        ta.value = v;
        autoGrow(ta);
        touch(p);
      });
    });

    detailRow.appendChild(ta);
    detailRow.appendChild(aiBtn);

    card.appendChild(top);
    card.appendChild(detailRow);
    return card;
  }

  function populateLinkSelect(select, currentId) {
    select.innerHTML = '<option value="">Link to project…</option>';
    state.data.projects
      .slice()
      .sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); })
      .forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = projectDisplayName(p);
        select.appendChild(opt);
      });
    select.value = currentId || "";
  }

  function buildItemRow(section, item) {
    var row = document.createElement("div");
    row.className = "irow";
    row.title = item.updatedAt ? "Updated " + formatDate(item.updatedAt) : "";

    var ta = document.createElement("textarea");
    ta.rows = 1;
    ta.placeholder = ITEM_SECTIONS[section].label + " — describe it";
    ta.value = item.text || "";
    ta.addEventListener("input", function () {
      item.text = ta.value;
      autoGrow(ta);
      touch(item);
    });

    var select = document.createElement("select");
    select.className = "irow-link";
    select.title = "Optional: link this item to a project";
    populateLinkSelect(select, item.projectId);
    select.addEventListener("change", function () {
      item.projectId = select.value || "";
      touch(item);
    });

    var aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "btn-ai";
    aiBtn.textContent = "✨";
    aiBtn.title = "AI rewrite this item";
    aiBtn.addEventListener("click", function () {
      var linked = item.projectId ? findProject(item.projectId) : null;
      var prompt = buildRewritePrompt(ITEM_SECTIONS[section].label, linked ? linked.name : "", "");
      runRewriteGeneric(aiBtn, prompt, ta.value, function (v) {
        item.text = v;
        ta.value = v;
        autoGrow(ta);
        touch(item);
      });
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-x";
    delBtn.textContent = "✕";
    delBtn.title = "Delete item";
    delBtn.addEventListener("click", function () {
      if (!confirm("Delete this item? This cannot be undone.")) return;
      state.data[section] = state.data[section].filter(function (x) { return x.id !== item.id; });
      persist();
      rebuildAll();
    });

    row.appendChild(ta);
    row.appendChild(select);
    row.appendChild(aiBtn);
    row.appendChild(delBtn);
    return row;
  }

  function updateCounts() {
    document.querySelectorAll(".esec-count").forEach(function (el) {
      var n = state.data[el.getAttribute("data-count")].length;
      el.textContent = n ? String(n) : "";
    });
  }

  function appendEmptyNote(container, text) {
    var note = document.createElement("div");
    note.className = "esec-empty";
    note.textContent = text;
    container.appendChild(note);
  }

  function buildEditor() {
    listEls.projects.innerHTML = "";
    state.data.projects.forEach(function (p) {
      listEls.projects.appendChild(buildProjectCard(p));
    });
    if (!state.data.projects.length) {
      appendEmptyNote(listEls.projects, "No projects yet — click “+ Add Project” to start.");
    }

    ITEM_SECTION_KEYS.forEach(function (section) {
      listEls[section].innerHTML = "";
      state.data[section].forEach(function (item) {
        listEls[section].appendChild(buildItemRow(section, item));
      });
      if (!state.data[section].length) {
        appendEmptyNote(listEls[section], "None — click “+ Add” if you need one.");
      }
    });

    updateCounts();
    document.querySelectorAll(".editor textarea").forEach(autoGrow);
  }

  function addProject() {
    var now = nowIso();
    state.data.projects.unshift({
      id: uid(), owner: "", name: "", shortcode: "", detail: "",
      flagHighlight: false, flagRisk: false, flagOnHold: false,
      createdAt: now, updatedAt: now
    });
    persist();
    rebuildAll();
    var firstInput = listEls.projects.querySelector("input");
    if (firstInput) {
      firstInput.focus();
      firstInput.scrollIntoView({ block: "nearest" });
    }
  }

  function addItem(section) {
    var now = nowIso();
    state.data[section].unshift({ id: uid(), text: "", projectId: "", createdAt: now, updatedAt: now });
    persist();
    rebuildAll();
    var firstTa = listEls[section].querySelector("textarea");
    if (firstTa) {
      firstTa.focus();
      firstTa.scrollIntoView({ block: "nearest" });
    }
  }

  // ---- Live report preview ----

  function refreshOwnerDatalist() {
    var owners = {};
    state.data.projects.forEach(function (p) {
      var o = (p.owner || "").trim();
      if (o) owners[o] = true;
    });
    ownerOptionsEl.innerHTML = Object.keys(owners).sort().map(function (o) {
      return '<option value="' + escapeHtml(o) + '">';
    }).join("");
  }

  // Refresh the project dropdowns on item rows in place (skipping the one
  // being used) so renamed/added projects show up without rebuilding the DOM.
  function refreshLinkSelects() {
    document.querySelectorAll(".irow select").forEach(function (select) {
      if (document.activeElement === select) return;
      populateLinkSelect(select, select.value);
    });
  }

  function refreshReport() {
    reportViewEl.innerHTML = buildReportHtml(true);
    refreshOwnerDatalist();
    refreshLinkSelects();
    updateCounts();
  }

  var reportTimer = null;
  function queueReportRefresh() {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(refreshReport, 250);
  }

  function rebuildAll() {
    buildEditor();
    refreshReport();
  }

  // ---- Report: grouped by category, then owner ----

  var printAreaEl = document.getElementById("printArea");

  var CATEGORY_META = [
    { key: "highlights", heading: "Key Highlights" },
    { key: "inProgress", heading: "In Progress" },
    { key: "risks", heading: "Risks" },
    { key: "onHold", heading: "On Hold" },
    { key: "itRequests", heading: ITEM_SECTIONS.itRequests.printHeading },
    { key: "powerBi", heading: ITEM_SECTIONS.powerBi.printHeading }
  ];

  function ownerKeyFor(name) {
    return (name || "").trim() || "Unassigned";
  }

  function emptyOwnerSections() {
    return { highlights: [], inProgress: [], risks: [], onHold: [], itRequests: [], powerBi: [] };
  }

  function buildOwnerGroups() {
    var groups = {};
    function getGroup(owner) {
      if (!groups[owner]) groups[owner] = emptyOwnerSections();
      return groups[owner];
    }

    state.data.projects.forEach(function (p) {
      var g = getGroup(ownerKeyFor(p.owner));
      if (p.flagHighlight) g.highlights.push({ type: "project", data: p });
      // In Progress holds only unflagged projects: a Key Highlight, At Risk,
      // or On Hold flag moves the project into that section instead.
      if (!p.flagHighlight && !p.flagRisk && !p.flagOnHold) g.inProgress.push({ type: "project", data: p });
      if (p.flagRisk) g.risks.push({ type: "project", data: p });
      if (p.flagOnHold) g.onHold.push({ type: "project", data: p });
    });

    function addItems(list, key) {
      list.forEach(function (item) {
        var owner = "Unassigned";
        if (item.projectId) {
          var proj = findProject(item.projectId);
          if (proj) owner = ownerKeyFor(proj.owner);
        }
        getGroup(owner)[key].push({ type: "item", data: item });
      });
    }
    addItems(state.data.risks, "risks");
    addItems(state.data.onHold, "onHold");
    addItems(state.data.itRequests, "itRequests");
    addItems(state.data.powerBi, "powerBi");

    var ownerNames = Object.keys(groups).filter(function (o) { return o !== "Unassigned"; }).sort();
    if (groups.Unassigned) ownerNames.push("Unassigned");
    return ownerNames.map(function (owner) { return { owner: owner, sections: groups[owner] }; });
  }

  function buildCategoryGroups() {
    var ownerGroups = buildOwnerGroups();
    return CATEGORY_META.map(function (meta) {
      var owners = ownerGroups
        .map(function (og) { return { owner: og.owner, entries: og.sections[meta.key] }; })
        .filter(function (o) { return o.entries.length > 0; });
      return { key: meta.key, heading: meta.heading, owners: owners };
    });
  }

  // Every owner group renders in the same fixed shape:
  //   Owner
  //     Project
  //       - description bullet
  //       - description bullet
  // Standalone items are grouped under their linked project's name; items with
  // no linked project render as plain bullets at the end of the owner group.
  function ownerEntriesToProjectGroups(entries) {
    var groups = [];
    var byKey = {};
    entries.forEach(function (entry) {
      var name, points;
      if (entry.type === "project") {
        name = projectReportName(entry.data);
        points = linesToArray(entry.data.detail);
      } else {
        var linked = entry.data.projectId ? findProject(entry.data.projectId) : null;
        name = linked ? projectReportName(linked) : "";
        points = (entry.data.text || "").trim() ? [entry.data.text.trim()] : [];
      }
      var key = name.toLowerCase();
      var g = byKey[key];
      if (!g) {
        g = byKey[key] = { name: name, points: [] };
        groups.push(g);
      }
      g.points = g.points.concat(points);
    });
    return groups.filter(function (g) { return g.name || g.points.length; });
  }

  function renderOwnerSubgroupHtml(o) {
    var groups = ownerEntriesToProjectGroups(o.entries);
    var html = '<div class="owner-subgroup"><h4>' + escapeHtml(o.owner) + "</h4>";
    var loose = [];
    groups.forEach(function (g) {
      if (!g.name) { loose = loose.concat(g.points); return; }
      html += '<div class="report-project"><div class="report-project-name">' + escapeHtml(g.name) + "</div>";
      html += g.points.length
        ? "<ul>" + g.points.map(function (pt) { return "<li>" + escapeHtml(pt) + "</li>"; }).join("") + "</ul>"
        : '<div class="report-no-points">No update provided.</div>';
      html += "</div>";
    });
    if (loose.length) {
      html += '<ul class="report-loose">' +
        loose.map(function (pt) { return "<li>" + escapeHtml(pt) + "</li>"; }).join("") + "</ul>";
    }
    return html + "</div>";
  }

  function renderCategoryBlockHtml(catGroup, includeCopyButton) {
    var body = catGroup.owners.length
      ? catGroup.owners.map(renderOwnerSubgroupHtml).join("")
      : '<div class="none">None reported</div>';

    var copyBtnHtml = includeCopyButton
      ? '<button type="button" class="btn copy-category-btn" data-category="' + escapeHtml(catGroup.key) + '">📋 Copy</button>'
      : "";

    return (
      '<div class="print-card category-block">' +
      '<div class="category-block-header"><h2>' + escapeHtml(catGroup.heading) + "</h2>" + copyBtnHtml + "</div>" +
      body +
      "</div>"
    );
  }

  function buildReportHtml(includeCopyButtons) {
    var groups = buildCategoryGroups();
    var heading = '<h1 class="report-title">Project Feedback Report - ' +
      new Date().toLocaleDateString() + "</h1>";
    if (!hasAnyData()) {
      return heading + '<p class="none">There is nothing to report yet.</p>';
    }
    return heading + groups.map(function (g) { return renderCategoryBlockHtml(g, includeCopyButtons); }).join("");
  }

  function hasAnyData() {
    return state.data.projects.length > 0 || state.data.risks.length > 0 ||
      state.data.onHold.length > 0 || state.data.itRequests.length > 0 || state.data.powerBi.length > 0;
  }

  function printReport() {
    if (!hasAnyData()) {
      alert("There is nothing to report yet.");
      return;
    }
    printAreaEl.innerHTML = buildReportHtml(false);
    window.print();
  }

  // ---- Report: plain text for copying ----

  function ownerSubgroupPlainText(o) {
    var lines = [o.owner];
    var loose = [];
    ownerEntriesToProjectGroups(o.entries).forEach(function (g) {
      if (!g.name) { loose = loose.concat(g.points); return; }
      lines.push("- " + g.name);
      g.points.forEach(function (pt) { lines.push("  - " + pt); });
    });
    loose.forEach(function (pt) { lines.push("- " + pt); });
    return lines;
  }

  function categoryGroupPlainText(catGroup) {
    var lines = [catGroup.heading.toUpperCase(), "=".repeat(catGroup.heading.length)];
    catGroup.owners.forEach(function (o) {
      lines.push("");
      lines.push.apply(lines, ownerSubgroupPlainText(o));
    });
    return lines.join("\n");
  }

  function fullReportPlainText() {
    var groups = buildCategoryGroups();
    var header = "Project Feedback Report - " + new Date().toLocaleDateString();
    if (!hasAnyData()) return header + "\n\nThere is nothing to report yet.";
    return header + "\n\n" + groups.map(categoryGroupPlainText).join("\n\n");
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(textarea);
      if (ok) resolve(); else reject(new Error("Copy command was blocked by the browser"));
    });
  }

  function flashCopyFeedback(button) {
    var original = button.textContent;
    button.textContent = "Copied!";
    setTimeout(function () { button.textContent = original; }, 1500);
  }

  function handleCopyFullReport(button) {
    if (!hasAnyData()) {
      alert("There is nothing to report yet.");
      return;
    }
    copyTextToClipboard(fullReportPlainText())
      .then(function () { flashCopyFeedback(button); })
      .catch(function (err) { alert("Copy failed: " + err.message); });
  }

  function handleCopyCategoryBlock(categoryKey, button) {
    var groups = buildCategoryGroups();
    var group = groups.find(function (g) { return g.key === categoryKey; });
    if (!group) return;
    copyTextToClipboard(categoryGroupPlainText(group))
      .then(function () { flashCopyFeedback(button); })
      .catch(function (err) { alert("Copy failed: " + err.message); });
  }

  // ---- Export / Import (JSON backup) ----

  function exportData() {
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "project-feedback-tracker-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.projects)) {
          throw new Error("Invalid file format");
        }
        if (hasAnyData()) {
          if (!confirm("Importing will replace all existing data. Continue?")) return;
        }
        state.data = Object.assign(emptyData(), parsed);
        saveData();
        rebuildAll();
      } catch (e) {
        alert("Could not import file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---- CSV template / import ----

  var CSV_HEADERS = [
    "Type", "Owner", "Project Name", "Shortcode", "Detail / Description",
    "Highlight", "At Risk", "On Hold", "Linked Project Shortcode"
  ];

  var SECTION_CSV_TYPE = {
    risks: "Risk", onHold: "On Hold", itRequests: "IT Support", powerBi: "Power BI"
  };

  function csvEscape(v) {
    v = v == null ? "" : String(v);
    if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function rowsToCsv(rows) {
    return rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n") + "\r\n";
  }

  function csvTemplateRows() {
    return [
      CSV_HEADERS,
      ["Project", "Stefan Botha", "Sales Dashboard Revamp", "SDR", "Executive sign-off received. | DAX build underway.", "Yes", "No", "No", ""],
      ["Project", "Amy Chen", "Inventory Forecast Model", "IFM", "Model accuracy validated against Q2 actuals.", "No", "Yes", "No", ""],
      ["Project", "Amy Chen", "HR Attrition Report", "HAR", "Paused pending updated data source access.", "No", "No", "Yes", ""],
      ["Risk", "", "", "", "Source system access delayed by two weeks.", "", "", "", "IFM"],
      ["On Hold", "", "", "", "Vendor confirming licence terms.", "", "", "", ""],
      ["IT Support", "", "", "", "VPN access request for contractor - INC0045821.", "", "", "", "SDR"],
      ["Power BI", "", "", "", "Workspace licence request - HD-1123.", "", "", "", ""]
    ];
  }

  function dataToCsvRows() {
    var rows = [CSV_HEADERS];
    state.data.projects.forEach(function (p) {
      rows.push([
        "Project", p.owner || "", p.name || "", p.shortcode || "",
        linesToArray(p.detail).join(" | "),
        p.flagHighlight ? "Yes" : "No",
        p.flagRisk ? "Yes" : "No",
        p.flagOnHold ? "Yes" : "No",
        ""
      ]);
    });
    ITEM_SECTION_KEYS.forEach(function (section) {
      state.data[section].forEach(function (item) {
        var linked = item.projectId ? findProject(item.projectId) : null;
        rows.push([
          SECTION_CSV_TYPE[section], "", "", "", item.text || "",
          "", "", "", linked ? (linked.shortcode || "") : ""
        ]);
      });
    });
    return rows;
  }

  function downloadCsv(content, filename) {
    var blob = new Blob([content], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (hasAnyData()) {
      downloadCsv(rowsToCsv(dataToCsvRows()),
        "project-feedback-tracker-export-" + new Date().toISOString().slice(0, 10) + ".csv");
    } else {
      downloadCsv(rowsToCsv(csvTemplateRows()), "project-feedback-tracker-template.csv");
    }
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var len = text.length;
    while (i < len) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  function normHeader(h) {
    return (h || "").toLowerCase().replace(/[\s_/]+/g, " ").trim();
  }

  function headerIndexMap(headerRow) {
    var map = {};
    headerRow.forEach(function (h, idx) { map[normHeader(h)] = idx; });
    return map;
  }

  function colValue(row, map, names) {
    for (var i = 0; i < names.length; i++) {
      var idx = map[names[i]];
      if (idx !== undefined && row[idx] !== undefined) return row[idx].trim();
    }
    return "";
  }

  function parseBool(v) {
    return /^(yes|y|true|1|x|✓)$/i.test((v || "").trim());
  }

  function typeToSection(v) {
    var t = normHeader(v);
    if (t.indexOf("project") === 0) return "project";
    if (t.indexOf("risk") === 0) return "risks";
    if (t.indexOf("hold") !== -1) return "onHold";
    if (t.indexOf("it") === 0) return "itRequests";
    if (t.indexOf("power") === 0) return "powerBi";
    return null;
  }

  function detailToPoints(v) {
    return (v || "")
      .split(/\r?\n|\s*\|\s*/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; })
      .join("\n");
  }

  function importCsv(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var rows = parseCsv(reader.result).filter(function (r) {
          return r.some(function (c) { return (c || "").trim() !== ""; });
        });
        if (rows.length < 1) throw new Error("The file is empty.");

        var map = headerIndexMap(rows[0]);
        if (map["type"] === undefined) {
          throw new Error('Missing a "Type" column. Download the CSV template for the expected format.');
        }

        var data = emptyData();
        var shortcodeToId = {};
        var pendingItems = [];
        var skipped = 0;
        var now = nowIso();

        for (var r = 1; r < rows.length; r++) {
          var row = rows[r];
          var section = typeToSection(colValue(row, map, ["type"]));
          if (!section) { skipped++; continue; }

          if (section === "project") {
            var name = colValue(row, map, ["project name", "name"]);
            if (!name) { skipped++; continue; }
            var shortcode = sanitizeShortcode(colValue(row, map, ["shortcode", "code"]));
            var project = {
              id: uid(),
              owner: colValue(row, map, ["owner", "responsible owner"]),
              name: name,
              shortcode: shortcode,
              detail: detailToPoints(colValue(row, map, ["detail description", "detail", "description", "latest feedback", "feedback"])),
              flagHighlight: parseBool(colValue(row, map, ["highlight", "key highlight", "feature in key highlights"])),
              flagRisk: parseBool(colValue(row, map, ["at risk", "risk", "flag as at risk"])),
              flagOnHold: parseBool(colValue(row, map, ["on hold", "onhold", "flag as on hold"])),
              createdAt: now,
              updatedAt: now
            };
            data.projects.push(project);
            if (shortcode) shortcodeToId[shortcode] = project.id;
          } else {
            var textVal = colValue(row, map, ["detail description", "description", "detail", "text"]);
            if (!textVal) { skipped++; continue; }
            pendingItems.push({
              section: section,
              text: textVal,
              linkShortcode: sanitizeShortcode(colValue(row, map, ["linked project shortcode", "linked project", "linked shortcode", "link"]))
            });
          }
        }

        var unlinked = 0;
        pendingItems.forEach(function (pi) {
          var projectId = "";
          if (pi.linkShortcode) {
            if (shortcodeToId[pi.linkShortcode]) projectId = shortcodeToId[pi.linkShortcode];
            else unlinked++;
          }
          data[pi.section].push({ id: uid(), text: pi.text, projectId: projectId, createdAt: now, updatedAt: now });
        });

        var itemCount = data.risks.length + data.onHold.length + data.itRequests.length + data.powerBi.length;
        var summary = "Import will replace all current data with " + data.projects.length +
          " project(s) and " + itemCount + " item(s).";
        if (skipped) summary += "\n" + skipped + " row(s) will be skipped (blank or unrecognised Type).";
        if (unlinked) summary += "\n" + unlinked + " item(s) reference a shortcode with no matching project and will be left unlinked.";
        summary += "\n\nContinue?";
        if (!confirm(summary)) return;

        state.data = data;
        saveData();
        rebuildAll();
      } catch (e) {
        alert("Could not import CSV: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---- AI rewrite settings ----

  var settingsModalEl = document.getElementById("settingsModal");
  var groqApiKeyInputEl = document.getElementById("groqApiKeyInput");
  var groqModelInputEl = document.getElementById("groqModelInput");

  var DEFAULT_MODEL = "openai/gpt-oss-120b";

  // Groq shut these models down (free/dev tiers, Jul–Aug 2026); calling them returns a 400,
  // so saved settings that still reference one are mapped to Groq's recommended replacement.
  var RETIRED_MODELS = {
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "meta-llama/llama-4-scout-17b-16e-instruct": "openai/gpt-oss-120b"
  };

  function loadAiSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      var settings = raw ? JSON.parse(raw) : { apiKey: "", model: DEFAULT_MODEL };
      if (!settings.model || RETIRED_MODELS[settings.model]) {
        settings.model = RETIRED_MODELS[settings.model] || DEFAULT_MODEL;
      }
      return settings;
    } catch (e) {
      return { apiKey: "", model: DEFAULT_MODEL };
    }
  }

  function saveAiSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function openSettingsModal() {
    var settings = loadAiSettings();
    groqApiKeyInputEl.value = settings.apiKey || "";
    groqModelInputEl.value = settings.model || DEFAULT_MODEL;
    settingsModalEl.hidden = false;
  }

  function closeSettingsModal() {
    settingsModalEl.hidden = true;
  }

  function handleSaveSettings() {
    saveAiSettings({
      apiKey: groqApiKeyInputEl.value.trim(),
      model: groqModelInputEl.value
    });
    closeSettingsModal();
  }

  // ---- AI rewrite ----

  var NO_INVENTING_RULE =
    "Use only what is given in the source text below — do not add facts, numbers, dates, " +
    "ticket references, names, causes, outcomes, or next steps that are not explicitly stated in it. " +
    "If the source is vague or incomplete, keep the rewrite equally vague rather than filling gaps " +
    "with plausible-sounding detail. When in doubt, prefer under-stating over guessing.";

  var VOICE_RULE =
    "Write in a semi-humanized but still corporate voice — like a capable colleague giving a status " +
    "update out loud, not a press release or robotic corporate-speak. Avoid stiff filler phrases " +
    "(e.g. \"in order to\", \"it is important to note\", \"moving forward\") and avoid buzzword-stuffing, " +
    "but keep it professional and fit for a business audience.";

  var PRESERVE_TERMS_RULE =
    "This is a corporate report where named things are chosen deliberately, so preserve every proper " +
    "noun and identifier exactly as written — project and product names, tool and system names, " +
    "people's names, shortcodes, ticket and reference numbers, dates, and figures. Do not translate, " +
    "rename, abbreviate, re-spell, or swap any of these for a synonym, and never change the meaning " +
    "of what is stated. You may improve the grammar, phrasing, and clarity of the surrounding wording, " +
    "but the named things, numbers, and the underlying meaning must survive unchanged.";

  function buildRewritePrompt(label, contextName, extraContext, isList) {
    var parts = [];
    parts.push(
      "You are assisting with a technical Power BI / IT project status report used as meeting " +
      'minutes: entries are talking points to be discussed live, so rewrite the following "' + label +
      '" text' + (contextName ? ' for "' + contextName + '"' : "") + "."
    );
    parts.push(VOICE_RULE);
    parts.push(
      "Use correct domain terminology (e.g. data model, refresh, pipeline, access, workspace) where it " +
      "fits the source text, but keep every point tight and short — a single crisp sentence (or two at " +
      "most) that captures the essence of the update. Do not expand, elaborate, or add background beyond " +
      "what the source states."
    );
    parts.push(
      "Never repeat yourself: do not restate the same idea, fact, or phrasing more than once, and do not " +
      "circle back to a topic already covered. Each point must say something distinct — if two points " +
      "would say the same thing, keep only the clearest one. Prefer brevity over completeness."
    );
    if (contextName) {
      parts.push(
        'Do not restate "' + contextName + '" or any other project/owner name inside your rewritten ' +
        "text — it is already shown separately as a heading, so just describe the update itself."
      );
    }
    if (extraContext) parts.push(extraContext);
    if (isList) {
      parts.push(
        "The input may contain multiple points separated by line breaks; treat each line as a " +
        "separate point and return the same number of points, one per line."
      );
    }
    parts.push(PRESERVE_TERMS_RULE);
    parts.push(NO_INVENTING_RULE);
    parts.push("Do not pad it with filler, and do not add bullet characters or numbering.");
    parts.push("Return only the rewritten text, with no preamble, commentary, or quotation marks.");
    return parts.join(" ");
  }

  function buildTitleRewritePrompt(contextOwner) {
    return "You are lightly correcting a short project title for a technical status report" +
      (contextOwner ? ' owned by "' + contextOwner + '"' : "") + ". This title is used in a " +
      "corporate setting where the exact wording is deliberate, so make the smallest possible change. " +
      "You may ONLY fix spelling and capitalisation, and expand a clear abbreviation to its full form " +
      "(e.g. \"dev\" to \"Development\", \"mgmt\" to \"Management\", \"Q\" to \"Quarter\"). Do NOT " +
      "reword, reorder, add or remove words, swap in synonyms, or change the name or meaning in any " +
      "way — every original term must remain the same term, just correctly spelled and expanded. If " +
      "the title is already correct, or you are unsure whether a change alters its meaning, return it " +
      "exactly as given. Keep it concise — a short title, not a sentence or description. " +
      NO_INVENTING_RULE + " Return only the corrected title, with no preamble, commentary, or " +
      "quotation marks.";
  }

  function callGroqMessages(apiKey, model, messages) {
    return fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.3,
        messages: messages
      })
    }).catch(function (err) {
      if (err instanceof TypeError) {
        throw new Error(
          "Could not reach the Groq API (\"" + err.message + "\"). This usually means: no internet " +
          "connection, a firewall/proxy blocking api.groq.com, or your browser blocking network " +
          "requests from a local file. Try opening this page in Chrome or Edge, and check your connection."
        );
      }
      throw err;
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error("Groq API error " + res.status + ": " + text.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error("Groq API returned no content");
      return content.trim();
    });
  }

  function callGroq(apiKey, model, systemPrompt, userText) {
    return callGroqMessages(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ]);
  }

  function buildShortcodePrompt() {
    return "You are creating a short project shortcode for a status report. From the project name " +
      "given below, produce a concise uppercase abbreviation of 2 to 5 characters (letters, optionally " +
      "with a digit, but no spaces or punctuation) that a reader could use to refer to the project — " +
      "normally the initials of its main words, in their original order. Derive it strictly and only " +
      "from the words actually present in the given project name: do not introduce unrelated letters, " +
      "pull in words that are not in the name, or invent a different or more specific name. If the " +
      "name is a single word, use its opening letters. Return only the shortcode, nothing else.";
  }

  function sanitizeShortcode(v) {
    v = (v || "").trim();
    if (!v) return "";
    // Prefer an existing all-caps alphanumeric token (e.g. "SDR" inside a longer reply).
    var m = v.match(/\b[A-Z][A-Z0-9]{1,5}\b/);
    if (m) return m[0];
    // Otherwise take the last word-ish token and uppercase it.
    var tokens = v.split(/[^A-Za-z0-9]+/).filter(Boolean);
    var pick = tokens.length ? tokens[tokens.length - 1] : v;
    return pick.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function runRewriteGeneric(button, systemPrompt, sourceText, applyResult) {
    var settings = loadAiSettings();
    if (!settings.apiKey) {
      openSettingsModal();
      return;
    }

    var text = (sourceText || "").trim();
    if (!text) return;

    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "…";
    button.classList.remove("error");

    callGroq(settings.apiKey, settings.model, systemPrompt, text)
      .then(function (rewritten) {
        applyResult(rewritten);
        button.textContent = originalLabel;
        button.disabled = false;
      })
      .catch(function (err) {
        console.error(err);
        button.textContent = "Retry";
        button.classList.add("error");
        button.disabled = false;
        alert("Rewrite failed: " + err.message);
      });
  }

  function projectFlagContext(project) {
    var flags = [];
    if (project.flagHighlight) flags.push("a Key Highlight");
    if (project.flagRisk) flags.push("At Risk");
    if (project.flagOnHold) flags.push("On Hold");
    if (!flags.length) return "";
    return "This project is currently flagged as: " + flags.join(", ") + ".";
  }

  // ---- AI undo (one level, survives reload) ----

  var UNDO_KEY = "projectFeedbackTracker.undoSnapshot";
  var btnUndoAi = document.getElementById("btnUndoAi");

  function getUndoSnapshot() {
    try {
      var raw = localStorage.getItem(UNDO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function updateUndoButton() {
    var snap = getUndoSnapshot();
    btnUndoAi.hidden = !snap;
    if (snap) btnUndoAi.title = "Restore data to before: " + snap.label + " (" + formatDate(snap.ts) + ")";
  }

  function setUndoSnapshot(label, snapshotData) {
    try {
      localStorage.setItem(UNDO_KEY, JSON.stringify({ label: label, ts: nowIso(), data: snapshotData }));
    } catch (e) {
      console.error("Could not store undo snapshot", e);
    }
    updateUndoButton();
  }

  function clearUndoSnapshot() {
    localStorage.removeItem(UNDO_KEY);
    updateUndoButton();
  }

  function undoLastAi() {
    var snap = getUndoSnapshot();
    if (!snap) return;
    if (!confirm('Undo "' + snap.label + '" from ' + formatDate(snap.ts) +
      "? All changes made since then — including manual edits — will be reverted.")) return;
    state.data = Object.assign(emptyData(), snap.data);
    saveData();
    clearUndoSnapshot();
    rebuildAll();
  }

  // ---- AI enhance all ----

  function collectEnhanceTasks() {
    var tasks = [];
    state.data.projects.forEach(function (p) {
      if (p.name && p.name.trim()) {
        tasks.push({
          contextLabel: p.name,
          getText: function () { return p.name; },
          setText: function (v) { p.name = v; p.updatedAt = nowIso(); },
          buildPrompt: function () { return buildTitleRewritePrompt(p.owner || ""); }
        });
        if (!p.shortcode || !p.shortcode.trim()) {
          tasks.push({
            contextLabel: (p.name || "project") + " (shortcode)",
            getText: function () { return p.name; },
            setText: function (v) {
              var code = sanitizeShortcode(v);
              if (code) { p.shortcode = code; p.updatedAt = nowIso(); }
            },
            buildPrompt: function () { return buildShortcodePrompt(); }
          });
        }
      }
      if (p.detail && p.detail.trim()) {
        tasks.push({
          contextLabel: p.name || "Latest Feedback / Status Caption",
          getText: function () { return p.detail; },
          setText: function (v) { p.detail = v; p.updatedAt = nowIso(); },
          buildPrompt: function () {
            return buildRewritePrompt("Latest Feedback / Status Caption", p.name || "", projectFlagContext(p), true);
          }
        });
      }
    });
    ITEM_SECTION_KEYS.forEach(function (section) {
      state.data[section].forEach(function (item) {
        if (!item.text || !item.text.trim()) return;
        tasks.push({
          contextLabel: ITEM_SECTIONS[section].label,
          getText: function () { return item.text; },
          setText: function (v) { item.text = v; item.updatedAt = nowIso(); },
          buildPrompt: function () {
            var linkedName = item.projectId ? ((findProject(item.projectId) || {}).name || "") : "";
            return buildRewritePrompt(ITEM_SECTIONS[section].label, linkedName, "");
          }
        });
      });
    });
    return tasks;
  }

  function enhanceAllEntries(button) {
    var settings = loadAiSettings();
    if (!settings.apiKey) {
      openSettingsModal();
      return;
    }

    var tasks = collectEnhanceTasks();
    if (!tasks.length) {
      alert("There is no feedback text to enhance yet.");
      return;
    }
    if (!confirm(
      "This will send " + tasks.length + " entr" + (tasks.length === 1 ? "y" : "ies") +
      " to Groq and replace each with an AI-reworded version. You can revert afterwards with " +
      "the Undo AI button. Continue?"
    )) {
      return;
    }

    setUndoSnapshot("AI Enhance All", JSON.parse(JSON.stringify(state.data)));

    var originalLabel = button.textContent;
    button.disabled = true;
    var failures = [];
    var index = 0;

    function runNext() {
      if (index >= tasks.length) {
        button.disabled = false;
        button.textContent = originalLabel;
        saveData();
        rebuildAll();
        if (failures.length) {
          alert("Enhanced " + (tasks.length - failures.length) + " of " + tasks.length +
            " entries. " + failures.length + " failed:\n" + failures.join("\n"));
        } else {
          alert("Enhanced all " + tasks.length + " entries.");
        }
        return;
      }

      var task = tasks[index];
      button.textContent = "Enhancing " + (index + 1) + " / " + tasks.length + "...";
      var systemPrompt = task.buildPrompt();

      callGroq(settings.apiKey, settings.model, systemPrompt, task.getText().trim())
        .then(function (rewritten) {
          task.setText(rewritten);
        })
        .catch(function (err) {
          console.error(err);
          failures.push(task.contextLabel + ": " + err.message);
        })
        .then(function () {
          index += 1;
          runNext();
        });
    }

    runNext();
  }

  // ---- AI update chat ----

  var chatPanelEl = document.getElementById("chatPanel");
  var chatMessagesEl = document.getElementById("chatMessages");
  var chatInputEl = document.getElementById("chatInput");
  var chatHistory = [];

  function chatAppend(role, text) {
    var div = document.createElement("div");
    div.className = "chat-msg " + (role === "user" ? "chat-user" : "chat-ai");
    div.textContent = text;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return div;
  }

  function chatStateSnapshot() {
    return JSON.stringify({
      projects: state.data.projects.map(function (p) {
        return {
          shortcode: p.shortcode || "",
          name: p.name,
          owner: p.owner,
          points: linesToArray(p.detail),
          flags: { highlight: !!p.flagHighlight, at_risk: !!p.flagRisk, on_hold: !!p.flagOnHold }
        };
      }),
      items: ITEM_SECTION_KEYS.reduce(function (acc, section) {
        acc[section] = state.data[section].map(function (item) {
          var linked = item.projectId ? findProject(item.projectId) : null;
          return { text: item.text, linked_shortcode: linked ? (linked.shortcode || "") : "" };
        });
        return acc;
      }, {})
    });
  }

  function buildChatSystemPrompt() {
    return "You are the built-in update assistant for a Power BI / IT project status tracker. " +
      "Users send quick, informal status updates; you convert them into structured actions that the " +
      "app applies to its data. Projects are usually referenced by shortcode (e.g. SDR) or by name.\n\n" +
      "CURRENT TRACKER DATA:\n" + chatStateSnapshot() + "\n\n" +
      "Respond with ONLY a JSON object — no prose, no code fences — in exactly this shape:\n" +
      '{"actions":[...],"reply":"one or two sentence confirmation for the user"}\n\n' +
      "Available actions:\n" +
      '1. {"action":"update_project","shortcode":"SDR","points":["..."],"flags":{"highlight":true,"at_risk":false,"on_hold":false}}\n' +
      '   "points" must be the COMPLETE merged list of status points for that project: keep every ' +
      "existing point that still applies, fold the user's new information in, and drop only points the " +
      'update clearly supersedes. Omit "points" entirely to leave the caption unchanged. In "flags", ' +
      "include only flags the user's message clearly changes.\n" +
      '2. {"action":"add_item","section":"risks","text":"...","link_shortcode":"SDR"} — for a new risk, ' +
      'on-hold item, IT support request, or Power BI help desk request. "section" is one of "risks", ' +
      '"onHold", "itRequests", "powerBi". "link_shortcode" is optional.\n' +
      '3. {"action":"add_project","name":"...","owner":"...","shortcode":"...","points":["..."]} — only ' +
      "when the user clearly describes a brand-new project.\n\n" +
      "Rules: " + VOICE_RULE + " Never restate the project name inside a point — it is shown as a " +
      "heading. " + PRESERVE_TERMS_RULE + " " + NO_INVENTING_RULE + " Only ever match an existing " +
      "project by the shortcode or name the user actually gives; never rename a project, alter its " +
      "shortcode, or reword an existing point beyond the grammar/clarity clean-up above. If the " +
      "message is ambiguous, or you cannot confidently match a project, return an empty actions array " +
      'and ask one short clarifying question in "reply".';
  }

  function extractJsonObject(text) {
    var t = (text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    var start = t.indexOf("{");
    var end = t.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object found");
    return JSON.parse(t.slice(start, end + 1));
  }

  function findProjectByRef(ref) {
    if (!ref) return null;
    var str = String(ref).trim();
    if (/^[A-Za-z0-9]{2,6}$/.test(str)) {
      var code = str.toUpperCase();
      var byCode = state.data.projects.find(function (p) { return (p.shortcode || "").toUpperCase() === code; });
      if (byCode) return byCode;
    }
    var lower = str.toLowerCase();
    return state.data.projects.find(function (p) { return (p.name || "").toLowerCase() === lower; }) ||
      state.data.projects.find(function (p) { return (p.name || "").toLowerCase().indexOf(lower) !== -1; }) ||
      null;
  }

  function normalizeChatSection(s) {
    var t = String(s || "").toLowerCase().replace(/[^a-z]/g, "");
    if (t.indexOf("risk") === 0) return "risks";
    if (t.indexOf("hold") !== -1) return "onHold";
    if (t.indexOf("it") === 0 || t.indexOf("support") !== -1) return "itRequests";
    if (t.indexOf("power") !== -1 || t.indexOf("bi") === 0 || t.indexOf("helpdesk") !== -1) return "powerBi";
    return null;
  }

  function readFlag(obj, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (obj && typeof obj[aliases[i]] === "boolean") return obj[aliases[i]];
    }
    return undefined;
  }

  function cleanPoints(points) {
    return (Array.isArray(points) ? points : [])
      .map(function (x) { return String(x).trim(); })
      .filter(Boolean);
  }

  function applyChatActions(actions) {
    var summary = [];
    var changed = false;
    var preState = JSON.stringify(state.data);

    (actions || []).forEach(function (a) {
      if (!a || typeof a !== "object") return;
      var act = String(a.action || "").toLowerCase();

      if (act === "update_project") {
        var p = findProjectByRef(a.shortcode || a.project || a.name);
        if (!p) {
          summary.push('No project matches "' + (a.shortcode || a.name || "?") + '" — skipped.');
          return;
        }
        var did = [];
        var pts = cleanPoints(a.points);
        if (pts.length) { p.detail = pts.join("\n"); did.push("status points updated"); }
        var flags = a.flags || a.set_flags || {};
        [
          [["highlight", "flagHighlight"], "flagHighlight", "Highlight"],
          [["at_risk", "atRisk", "risk"], "flagRisk", "At Risk"],
          [["on_hold", "onHold", "hold"], "flagOnHold", "On Hold"]
        ].forEach(function (def) {
          var val = readFlag(flags, def[0]);
          if (val !== undefined && p[def[1]] !== val) {
            p[def[1]] = val;
            did.push(def[2] + (val ? " on" : " off"));
          }
        });
        if (did.length) {
          p.updatedAt = nowIso();
          changed = true;
          summary.push("[" + (p.shortcode || p.name) + "] " + did.join(", "));
        }
        return;
      }

      if (act === "add_item") {
        var section = normalizeChatSection(a.section);
        var text = String(a.text || "").trim();
        if (!section || !text) {
          summary.push("Couldn't place one item (missing section or text) — skipped.");
          return;
        }
        var linked = findProjectByRef(a.link_shortcode || a.linked_shortcode || a.link);
        state.data[section].push({
          id: uid(), text: text, projectId: linked ? linked.id : "",
          createdAt: nowIso(), updatedAt: nowIso()
        });
        changed = true;
        summary.push("Added " + ITEM_SECTIONS[section].label +
          (linked ? " linked to [" + (linked.shortcode || linked.name) + "]" : ""));
        return;
      }

      if (act === "add_project") {
        var name = String(a.name || "").trim();
        if (!name) return;
        var code = sanitizeShortcode(a.shortcode || "");
        if (code && state.data.projects.some(function (p2) { return (p2.shortcode || "").toUpperCase() === code; })) {
          code = "";
        }
        var flags2 = a.flags || {};
        state.data.projects.push({
          id: uid(),
          owner: String(a.owner || "").trim(),
          name: name,
          shortcode: code,
          detail: cleanPoints(a.points).join("\n"),
          flagHighlight: readFlag(flags2, ["highlight", "flagHighlight"]) === true,
          flagRisk: readFlag(flags2, ["at_risk", "atRisk", "risk"]) === true,
          flagOnHold: readFlag(flags2, ["on_hold", "onHold", "hold"]) === true,
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
        changed = true;
        summary.push("Created project " + (code ? "[" + code + "] " : "") + name);
      }
    });

    if (changed) {
      setUndoSnapshot("AI chat update", JSON.parse(preState));
      saveData();
      rebuildAll();
    }
    return summary;
  }

  function handleChatSend() {
    var settings = loadAiSettings();
    if (!settings.apiKey) { openSettingsModal(); return; }
    var text = chatInputEl.value.trim();
    if (!text) return;

    chatAppend("user", text);
    chatInputEl.value = "";
    chatHistory.push({ role: "user", content: text });

    var thinking = chatAppend("ai", "Thinking…");
    var sendBtn = document.getElementById("btnChatSend");
    sendBtn.disabled = true;

    var messages = [{ role: "system", content: buildChatSystemPrompt() }].concat(chatHistory.slice(-8));

    callGroqMessages(settings.apiKey, settings.model, messages)
      .then(function (raw) {
        var parsed;
        try {
          parsed = extractJsonObject(raw);
        } catch (e) {
          throw new Error("The AI reply couldn't be understood — try rephrasing your update.");
        }
        var summary = applyChatActions(parsed.actions);
        var reply = String(parsed.reply || "Done.");
        chatHistory.push({ role: "assistant", content: reply });
        thinking.remove();
        chatAppend("ai", reply + (summary.length
          ? "\n\n" + summary.map(function (s) { return "• " + s; }).join("\n")
          : ""));
      })
      .catch(function (err) {
        console.error(err);
        thinking.remove();
        chatAppend("ai", "⚠️ " + err.message);
      })
      .then(function () { sendBtn.disabled = false; });
  }

  // ---- Wiring ----

  document.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var section = btn.getAttribute("data-add");
      if (section === "projects") addProject();
      else addItem(section);
    });
  });

  document.getElementById("btnPrintReport").addEventListener("click", printReport);
  document.getElementById("btnCopyReport").addEventListener("click", function (e) {
    handleCopyFullReport(e.currentTarget);
  });
  reportViewEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-category-btn");
    if (!btn) return;
    handleCopyCategoryBlock(btn.getAttribute("data-category"), btn);
  });

  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
  document.getElementById("importCsvFile").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file) importCsv(file);
    e.target.value = "";
  });
  document.getElementById("btnExport").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  document.getElementById("btnEnhanceAll").addEventListener("click", function (e) {
    enhanceAllEntries(e.currentTarget);
  });
  btnUndoAi.addEventListener("click", undoLastAi);

  document.getElementById("btnSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnSaveSettings").addEventListener("click", handleSaveSettings);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettingsModal);
  settingsModalEl.addEventListener("click", function (e) {
    if (e.target === settingsModalEl) closeSettingsModal();
  });

  // Header "More" dropdown menu
  var moreMenuEl = document.getElementById("moreMenu");
  var btnMoreMenuEl = document.getElementById("btnMoreMenu");
  var moreMenuListEl = document.getElementById("moreMenuList");

  function closeMoreMenu() {
    moreMenuListEl.hidden = true;
    btnMoreMenuEl.setAttribute("aria-expanded", "false");
  }

  btnMoreMenuEl.addEventListener("click", function (e) {
    e.stopPropagation();
    var willOpen = moreMenuListEl.hidden;
    moreMenuListEl.hidden = !willOpen;
    btnMoreMenuEl.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", function (e) {
    if (!moreMenuEl.contains(e.target)) closeMoreMenu();
  });

  moreMenuListEl.addEventListener("click", function (e) {
    if (e.target.closest(".menu-item")) closeMoreMenu();
  });

  document.getElementById("btnChatToggle").addEventListener("click", function () {
    chatPanelEl.hidden = !chatPanelEl.hidden;
    if (!chatPanelEl.hidden) chatInputEl.focus();
  });
  document.getElementById("btnChatClose").addEventListener("click", function () {
    chatPanelEl.hidden = true;
  });
  document.getElementById("btnChatSend").addEventListener("click", handleChatSend);
  chatInputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!moreMenuListEl.hidden) { closeMoreMenu(); return; }
      if (!settingsModalEl.hidden) { closeSettingsModal(); return; }
      if (!chatPanelEl.hidden) { chatPanelEl.hidden = true; }
      return;
    }
    // Everything saves as you type, so Ctrl+S just confirms.
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      persist();
    }
  });

  // ---- Init ----

  loadData();
  rebuildAll();
  updateUndoButton();
})();
