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

  var state = {
    data: { projects: [], risks: [], onHold: [], itRequests: [], powerBi: [] },
    activeSection: "projects",
    selectedId: null
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

  function currentArray(section) {
    return state.data[section];
  }

  function findProject(id) {
    return state.data.projects.find(function (p) { return p.id === id; });
  }

  // ---- Sidebar nav ----

  var navButtons = document.querySelectorAll(".nav-btn");
  var searchBoxEl = document.getElementById("searchBox");
  var itemListEl = document.getElementById("itemList");
  var btnNewItem = document.getElementById("btnNewItem");

  var sidebarListSectionEl = document.getElementById("sidebarListSection");
  var reportViewEl = document.getElementById("reportView");

  function setActiveSection(section) {
    state.activeSection = section;
    state.selectedId = null;
    navButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-section") === section);
    });
    searchBoxEl.value = "";

    if (section === "report") {
      sidebarListSectionEl.hidden = true;
      renderReportView();
    } else {
      sidebarListSectionEl.hidden = false;
      btnNewItem.textContent = section === "projects" ? "+ New Project" : "+ New " + ITEM_SECTIONS[section].label;
      renderList();
    }
    showSelected();
  }

  // ---- Rendering: sidebar list ----

  function renderList() {
    var filter = (searchBoxEl.value || "").toLowerCase();
    itemListEl.innerHTML = "";

    if (state.activeSection === "projects") {
      var projects = state.data.projects
        .filter(function (p) {
          return p.name.toLowerCase().indexOf(filter) !== -1 ||
            p.owner.toLowerCase().indexOf(filter) !== -1;
        })
        .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });

      projects.forEach(function (p) {
        var li = document.createElement("li");
        if (p.id === state.selectedId) li.className = "active";
        var badges = "";
        if (p.flagHighlight) badges += '<span class="badge badge-highlight">Highlight</span>';
        if (p.flagRisk) badges += '<span class="badge badge-risk">At Risk</span>';
        if (p.flagOnHold) badges += '<span class="badge badge-onhold">On Hold</span>';
        li.innerHTML =
          '<div class="li-name"></div>' +
          '<div class="li-owner"></div>' +
          '<div class="li-badges">' + badges + "</div>" +
          '<div class="li-updated"></div>';
        li.querySelector(".li-name").textContent = p.name || "Untitled Project";
        li.querySelector(".li-owner").textContent = p.owner || "Unassigned";
        li.querySelector(".li-updated").textContent = p.updatedAt ? "Updated " + formatDate(p.updatedAt) : "";
        li.addEventListener("click", function () { selectItem(p.id); });
        itemListEl.appendChild(li);
      });

      if (projects.length === 0) {
        appendEmptyListMessage(state.data.projects.length === 0 ? "No projects yet." : "No matches.");
      }
      return;
    }

    var items = currentArray(state.activeSection)
      .filter(function (item) { return item.text.toLowerCase().indexOf(filter) !== -1; })
      .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });

    items.forEach(function (item) {
      var li = document.createElement("li");
      if (item.id === state.selectedId) li.className = "active";
      var linkedProject = item.projectId ? findProject(item.projectId) : null;
      li.innerHTML =
        '<div class="li-name"></div>' +
        '<div class="li-owner"></div>' +
        '<div class="li-updated"></div>';
      var preview = item.text || "(empty)";
      li.querySelector(".li-name").textContent = preview.length > 70 ? preview.slice(0, 70) + "..." : preview;
      li.querySelector(".li-owner").textContent = linkedProject ? "Linked: " + linkedProject.name : "";
      li.querySelector(".li-updated").textContent = item.updatedAt ? "Updated " + formatDate(item.updatedAt) : "";
      li.addEventListener("click", function () { selectItem(item.id); });
      itemListEl.appendChild(li);
    });

    if (items.length === 0) {
      appendEmptyListMessage(currentArray(state.activeSection).length === 0 ? "None logged yet." : "No matches.");
    }
  }

  function appendEmptyListMessage(text) {
    var empty = document.createElement("li");
    empty.style.color = "#9aa0a6";
    empty.style.cursor = "default";
    empty.textContent = text;
    itemListEl.appendChild(empty);
  }

  // ---- Project form ----

  var emptyStateEl = document.getElementById("emptyState");
  var projectFormEl = document.getElementById("projectForm");
  var itemFormEl = document.getElementById("itemForm");

  var projectFields = {
    id: document.getElementById("projectId"),
    owner: document.getElementById("ownerInput"),
    name: document.getElementById("nameInput"),
    detail: document.getElementById("detailInput"),
    flagHighlight: document.getElementById("flagHighlightInput"),
    flagRisk: document.getElementById("flagRiskInput"),
    flagOnHold: document.getElementById("flagOnHoldInput")
  };

  var itemFields = {
    id: document.getElementById("itemId"),
    section: document.getElementById("itemSection"),
    text: document.getElementById("itemTextInput"),
    label: document.getElementById("itemTextLabel"),
    projectLink: document.getElementById("itemProjectLink")
  };

  function showSelected() {
    var id = state.selectedId;

    if (state.activeSection === "report") {
      projectFormEl.hidden = true;
      itemFormEl.hidden = true;
      emptyStateEl.hidden = true;
      reportViewEl.hidden = false;
      return;
    }
    reportViewEl.hidden = true;

    if (!id) {
      projectFormEl.hidden = true;
      itemFormEl.hidden = true;
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;

    if (state.activeSection === "projects") {
      var project = findProject(id);
      if (!project) { state.selectedId = null; showSelected(); return; }
      itemFormEl.hidden = true;
      projectFormEl.hidden = false;

      projectFields.id.value = project.id;
      projectFields.owner.value = project.owner || "";
      projectFields.name.value = project.name || "";
      projectFields.detail.value = project.detail || "";
      projectFields.flagHighlight.checked = !!project.flagHighlight;
      projectFields.flagRisk.checked = !!project.flagRisk;
      projectFields.flagOnHold.checked = !!project.flagOnHold;
    } else {
      var item = currentArray(state.activeSection).find(function (i) { return i.id === id; });
      if (!item) { state.selectedId = null; showSelected(); return; }
      projectFormEl.hidden = true;
      itemFormEl.hidden = false;

      itemFields.id.value = item.id;
      itemFields.section.value = state.activeSection;
      itemFields.text.value = item.text || "";
      itemFields.label.textContent = ITEM_SECTIONS[state.activeSection].label + " Description";
      populateProjectLinkOptions();
      itemFields.projectLink.value = item.projectId || "";
    }
  }

  function populateProjectLinkOptions() {
    var current = itemFields.projectLink.value;
    itemFields.projectLink.innerHTML = '<option value="">None</option>';
    state.data.projects
      .slice()
      .sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); })
      .forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name || "Untitled Project";
        itemFields.projectLink.appendChild(opt);
      });
    itemFields.projectLink.value = current;
  }

  function selectItem(id) {
    state.selectedId = id;
    renderList();
    showSelected();
  }

  function handleNewItem() {
    var now = nowIso();
    if (state.activeSection === "projects") {
      var project = {
        id: uid(),
        owner: "",
        name: "",
        detail: "",
        flagHighlight: false,
        flagRisk: false,
        flagOnHold: false,
        createdAt: now,
        updatedAt: now
      };
      state.data.projects.push(project);
      saveData();
      selectItem(project.id);
      projectFields.owner.focus();
    } else {
      var item = { id: uid(), text: "", projectId: "", createdAt: now, updatedAt: now };
      currentArray(state.activeSection).push(item);
      saveData();
      selectItem(item.id);
      itemFields.text.focus();
    }
  }

  function handleSaveProject(e) {
    e.preventDefault();
    var project = findProject(projectFields.id.value);
    if (!project) return;

    project.owner = projectFields.owner.value.trim();
    project.name = projectFields.name.value.trim();
    project.detail = projectFields.detail.value.trim();
    project.flagHighlight = projectFields.flagHighlight.checked;
    project.flagRisk = projectFields.flagRisk.checked;
    project.flagOnHold = projectFields.flagOnHold.checked;
    project.updatedAt = nowIso();

    saveData();
    renderList();
  }

  function handleDeleteProject() {
    var id = projectFields.id.value;
    var project = findProject(id);
    if (!project) return;
    if (!confirm('Delete project "' + project.name + '"? Linked risk/on-hold/request items will keep their text but lose the project link. This cannot be undone.')) return;

    state.data.projects = state.data.projects.filter(function (p) { return p.id !== id; });
    ["risks", "onHold", "itRequests", "powerBi"].forEach(function (section) {
      state.data[section].forEach(function (item) {
        if (item.projectId === id) item.projectId = "";
      });
    });
    state.selectedId = null;
    saveData();
    renderList();
    showSelected();
  }

  function handleSaveItem(e) {
    e.preventDefault();
    var section = itemFields.section.value;
    var item = currentArray(section).find(function (i) { return i.id === itemFields.id.value; });
    if (!item) return;

    item.text = itemFields.text.value.trim();
    item.projectId = itemFields.projectLink.value || "";
    item.updatedAt = nowIso();

    saveData();
    renderList();
  }

  function handleDeleteItem() {
    var section = itemFields.section.value;
    var id = itemFields.id.value;
    if (!confirm("Delete this item? This cannot be undone.")) return;

    state.data[section] = state.data[section].filter(function (i) { return i.id !== id; });
    state.selectedId = null;
    saveData();
    renderList();
    showSelected();
  }

  // ---- Report: grouped by owner ----

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
      if (!p.flagRisk && !p.flagOnHold) g.inProgress.push({ type: "project", data: p });
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

  function renderEntryHtml(entry) {
    if (entry.type === "project") {
      var p = entry.data;
      var caption = p.detail ? " — " + escapeHtml(p.detail) : "";
      return "<li><strong>" + escapeHtml(p.name || "Untitled Project") + "</strong>" + caption + "</li>";
    }
    var item = entry.data;
    var linked = item.projectId ? findProject(item.projectId) : null;
    var linkedHtml = linked ? " <em>— Project: " + escapeHtml(linked.name) + "</em>" : "";
    return "<li>" + escapeHtml(item.text) + linkedHtml + "</li>";
  }

  function renderOwnerGroupHtml(group, includeCopyButton) {
    var sectionsHtml = CATEGORY_META.map(function (meta) {
      var entries = group.sections[meta.key];
      if (!entries.length) return "";
      var body = "<ul>" + entries.map(renderEntryHtml).join("") + "</ul>";
      return '<div class="print-section"><h3>' + escapeHtml(meta.heading) + "</h3>" + body + "</div>";
    }).join("");

    var copyBtnHtml = includeCopyButton
      ? '<button type="button" class="btn copy-owner-btn" data-owner="' + escapeHtml(group.owner) + '">📋 Copy</button>'
      : "";

    return (
      '<div class="print-card owner-block">' +
      '<div class="owner-block-header"><h2>' + escapeHtml(group.owner) + "</h2>" + copyBtnHtml + "</div>" +
      (sectionsHtml || '<div class="none">Nothing to report for this owner.</div>') +
      "</div>"
    );
  }

  function buildReportHtml(includeCopyButtons) {
    var groups = buildOwnerGroups();
    var heading = '<h1 style="font-size:20px;margin-bottom:16px;">Project Feedback Report - ' +
      new Date().toLocaleDateString() + "</h1>";
    if (groups.length === 0) {
      return heading + '<p class="none">There is nothing to report yet.</p>';
    }
    return heading + groups.map(function (g) { return renderOwnerGroupHtml(g, includeCopyButtons); }).join("");
  }

  function renderReportView() {
    reportViewEl.innerHTML = buildReportHtml(true);
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

  function ownerGroupPlainText(group) {
    var lines = [group.owner.toUpperCase(), "=".repeat(group.owner.length)];
    CATEGORY_META.forEach(function (meta) {
      var entries = group.sections[meta.key];
      if (!entries.length) return;
      lines.push("");
      lines.push(meta.heading.toUpperCase());
      entries.forEach(function (entry) {
        if (entry.type === "project") {
          var p = entry.data;
          lines.push("- " + (p.name || "Untitled Project") + (p.detail ? ": " + p.detail : ""));
        } else {
          var item = entry.data;
          var linked = item.projectId ? findProject(item.projectId) : null;
          lines.push("- " + item.text + (linked ? " (Project: " + linked.name + ")" : ""));
        }
      });
    });
    return lines.join("\n");
  }

  function fullReportPlainText() {
    var groups = buildOwnerGroups();
    var header = "Project Feedback Report - " + new Date().toLocaleDateString();
    if (groups.length === 0) return header + "\n\nThere is nothing to report yet.";
    return header + "\n\n" + groups.map(ownerGroupPlainText).join("\n\n");
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

  function handleCopyOwnerBlock(ownerName, button) {
    var groups = buildOwnerGroups();
    var group = groups.find(function (g) { return g.owner === ownerName; });
    if (!group) return;
    copyTextToClipboard(ownerGroupPlainText(group))
      .then(function () { flashCopyFeedback(button); })
      .catch(function (err) { alert("Copy failed: " + err.message); });
  }

  // ---- Export / Import ----

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
        var hasExisting = state.data.projects.length + state.data.risks.length +
          state.data.onHold.length + state.data.itRequests.length + state.data.powerBi.length > 0;
        if (hasExisting) {
          if (!confirm("Importing will replace all existing data. Continue?")) return;
        }
        state.data = Object.assign(emptyData(), parsed);
        state.selectedId = null;
        saveData();
        renderList();
        showSelected();
      } catch (e) {
        alert("Could not import file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---- AI rewrite settings ----

  var settingsModalEl = document.getElementById("settingsModal");
  var groqApiKeyInputEl = document.getElementById("groqApiKeyInput");
  var groqModelInputEl = document.getElementById("groqModelInput");

  function loadAiSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { apiKey: "", model: "llama-3.3-70b-versatile" };
    } catch (e) {
      return { apiKey: "", model: "llama-3.3-70b-versatile" };
    }
  }

  function saveAiSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function openSettingsModal() {
    var settings = loadAiSettings();
    groqApiKeyInputEl.value = settings.apiKey || "";
    groqModelInputEl.value = settings.model || "llama-3.3-70b-versatile";
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

  function buildRewritePrompt(label, contextName) {
    return "You are assisting with a professional Power BI / IT project status report for internal " +
      'business stakeholders. Rewrite the following "' + label + '" text' +
      (contextName ? ' for "' + contextName + '"' : "") + " so it reads as clear, concise, " +
      "professional language suitable for a technical/business status report. Do not invent facts, " +
      "numbers, ticket references, or details that are not present in the source text. Return only " +
      "the rewritten text, with no preamble, commentary, or quotation marks, and no bullet characters.";
  }

  function callGroq(apiKey, model, systemPrompt, userText) {
    return fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ]
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

  function runRewrite(button, label, contextName, textarea) {
    var settings = loadAiSettings();
    if (!settings.apiKey) {
      openSettingsModal();
      return;
    }

    var currentText = textarea.value.trim();
    if (!currentText) return;

    var systemPrompt = buildRewritePrompt(label, contextName);
    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Rewriting...";
    button.classList.remove("error");

    callGroq(settings.apiKey, settings.model, systemPrompt, currentText)
      .then(function (rewritten) {
        textarea.value = rewritten;
        button.textContent = originalLabel;
        button.disabled = false;
      })
      .catch(function (err) {
        console.error(err);
        button.textContent = "Failed - retry";
        button.classList.add("error");
        button.disabled = false;
        alert("Rewrite failed: " + err.message);
      });
  }

  function handleRewriteProjectDetail(button) {
    runRewrite(button, "Latest Feedback / Status Caption", projectFields.name.value.trim(), projectFields.detail);
  }

  function handleRewriteItem(button) {
    var sectionInfo = ITEM_SECTIONS[itemFields.section.value];
    var linkedName = "";
    if (itemFields.projectLink.value) {
      var linked = findProject(itemFields.projectLink.value);
      if (linked) linkedName = linked.name;
    }
    runRewrite(button, sectionInfo.label, linkedName, itemFields.text);
  }

  // ---- Wiring ----

  navButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { setActiveSection(btn.getAttribute("data-section")); });
  });

  btnNewItem.addEventListener("click", handleNewItem);
  searchBoxEl.addEventListener("input", renderList);

  document.getElementById("btnPrintReport").addEventListener("click", printReport);
  document.getElementById("btnCopyReport").addEventListener("click", function (e) {
    handleCopyFullReport(e.currentTarget);
  });
  reportViewEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-owner-btn");
    if (!btn) return;
    handleCopyOwnerBlock(btn.getAttribute("data-owner"), btn);
  });
  document.getElementById("btnExport").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  projectFormEl.addEventListener("submit", handleSaveProject);
  document.getElementById("btnDeleteProject").addEventListener("click", handleDeleteProject);

  itemFormEl.addEventListener("submit", handleSaveItem);
  document.getElementById("btnDeleteItem").addEventListener("click", handleDeleteItem);

  document.querySelector('.btn-rewrite[data-field="detail"]').addEventListener("click", function (e) {
    handleRewriteProjectDetail(e.currentTarget);
  });
  document.getElementById("btnRewriteItem").addEventListener("click", function (e) {
    handleRewriteItem(e.currentTarget);
  });

  document.getElementById("btnSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnSaveSettings").addEventListener("click", handleSaveSettings);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettingsModal);
  settingsModalEl.addEventListener("click", function (e) {
    if (e.target === settingsModalEl) closeSettingsModal();
  });

  // ---- Init ----

  loadData();
  renderList();
  showSelected();
})();
