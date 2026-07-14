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

  function projectDisplayName(p) {
    var name = p.name || "Untitled Project";
    return p.shortcode ? "[" + p.shortcode + "] " + name : name;
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
        li.querySelector(".li-name").textContent = projectDisplayName(p);
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
    shortcode: document.getElementById("shortcodeInput"),
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
      projectFields.shortcode.value = project.shortcode || "";
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
        opt.textContent = projectDisplayName(p);
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
        shortcode: "",
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
    project.shortcode = projectFields.shortcode.value.trim();
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

  function buildCategoryGroups() {
    var ownerGroups = buildOwnerGroups();
    return CATEGORY_META.map(function (meta) {
      var owners = ownerGroups
        .map(function (og) { return { owner: og.owner, entries: og.sections[meta.key] }; })
        .filter(function (o) { return o.entries.length > 0; });
      return { key: meta.key, heading: meta.heading, owners: owners };
    });
  }

  function renderEntryHtml(entry) {
    if (entry.type === "project") {
      var p = entry.data;
      var caption = p.detail ? " — " + escapeHtml(p.detail) : "";
      return "<li><strong>" + escapeHtml(projectDisplayName(p)) + "</strong>" + caption + "</li>";
    }
    var item = entry.data;
    var linked = item.projectId ? findProject(item.projectId) : null;
    var linkedHtml = linked ? " <em>— Project: " + escapeHtml(projectDisplayName(linked)) + "</em>" : "";
    return "<li>" + escapeHtml(item.text) + linkedHtml + "</li>";
  }

  function renderCategoryBlockHtml(catGroup, includeCopyButton) {
    var body = catGroup.owners.length
      ? catGroup.owners.map(function (o) {
          return '<div class="owner-subgroup"><h4>' + escapeHtml(o.owner) + "</h4><ul>" +
            o.entries.map(renderEntryHtml).join("") + "</ul></div>";
        }).join("")
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
    var heading = '<h1 style="font-size:20px;margin-bottom:16px;">Project Feedback Report - ' +
      new Date().toLocaleDateString() + "</h1>";
    if (!hasAnyData()) {
      return heading + '<p class="none">There is nothing to report yet.</p>';
    }
    return heading + groups.map(function (g) { return renderCategoryBlockHtml(g, includeCopyButtons); }).join("");
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

  function entryPlainText(entry) {
    if (entry.type === "project") {
      var p = entry.data;
      return "- " + projectDisplayName(p) + (p.detail ? ": " + p.detail : "");
    }
    var item = entry.data;
    var linked = item.projectId ? findProject(item.projectId) : null;
    return "- " + item.text + (linked ? " (Project: " + projectDisplayName(linked) + ")" : "");
  }

  function categoryGroupPlainText(catGroup) {
    var lines = [catGroup.heading.toUpperCase(), "=".repeat(catGroup.heading.length)];
    catGroup.owners.forEach(function (o) {
      lines.push("");
      lines.push(o.owner);
      o.entries.forEach(function (entry) { lines.push(entryPlainText(entry)); });
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

  var NO_INVENTING_RULE =
    "Use only what is given in the source text below — do not add facts, numbers, dates, " +
    "ticket references, names, causes, outcomes, or next steps that are not explicitly stated in it. " +
    "If the source is vague or incomplete, keep the rewrite equally vague rather than filling gaps " +
    "with plausible-sounding detail. When in doubt, prefer under-stating over guessing.";

  function buildRewritePrompt(label, contextName, extraContext) {
    return "You are assisting with a technical Power BI / IT project status report used as meeting " +
      'minutes: entries are talking points to be discussed live, so rewrite the following "' + label +
      '" text' + (contextName ? ' for "' + contextName + '"' : "") + " in a precise, technical voice " +
      "using correct domain terminology (e.g. data model, refresh, pipeline, access, workspace) where " +
      "it fits the source text, and keep enough concrete detail (what changed, what's blocking, what's " +
      "next) that the point stands on its own for someone reading it before the meeting." +
      (extraContext ? " " + extraContext : "") + " " + NO_INVENTING_RULE + " Do not pad it with " +
      "filler. Return only the rewritten text, with no preamble, commentary, or quotation marks, and " +
      "no bullet characters.";
  }

  function buildTitleRewritePrompt(contextOwner) {
    return "You are tidying up a short project title for a technical status report" +
      (contextOwner ? ' owned by "' + contextOwner + '"' : "") + ". Clean up the wording, casing, and " +
      "grammar of the following project title without changing its subject or meaning, and without " +
      "inventing a different or more specific name. Keep it concise — a short title, not a sentence " +
      "or description. " + NO_INVENTING_RULE + " Return only the cleaned-up title, with no preamble, " +
      "commentary, or quotation marks.";
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

  function runRewriteWithPrompt(button, systemPrompt, textarea) {
    var settings = loadAiSettings();
    if (!settings.apiKey) {
      openSettingsModal();
      return;
    }

    var currentText = textarea.value.trim();
    if (!currentText) return;

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

  function projectFlagContext(project) {
    var flags = [];
    if (project.flagHighlight) flags.push("a Key Highlight");
    if (project.flagRisk) flags.push("At Risk");
    if (project.flagOnHold) flags.push("On Hold");
    if (!flags.length) return "";
    return "This project is currently flagged as: " + flags.join(", ") + ".";
  }

  function handleRewriteProjectName(button) {
    runRewriteWithPrompt(button, buildTitleRewritePrompt(projectFields.owner.value.trim()), projectFields.name);
  }

  function handleRewriteProjectDetail(button) {
    var project = findProject(projectFields.id.value);
    var systemPrompt = buildRewritePrompt(
      "Latest Feedback / Status Caption",
      projectFields.name.value.trim(),
      project ? projectFlagContext(project) : ""
    );
    runRewriteWithPrompt(button, systemPrompt, projectFields.detail);
  }

  function handleRewriteItem(button) {
    var sectionInfo = ITEM_SECTIONS[itemFields.section.value];
    var linkedName = "";
    if (itemFields.projectLink.value) {
      var linked = findProject(itemFields.projectLink.value);
      if (linked) linkedName = linked.name;
    }
    var systemPrompt = buildRewritePrompt(sectionInfo.label, linkedName, "");
    runRewriteWithPrompt(button, systemPrompt, itemFields.text);
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
      }
      if (p.detail && p.detail.trim()) {
        tasks.push({
          contextLabel: p.name || "Latest Feedback / Status Caption",
          getText: function () { return p.detail; },
          setText: function (v) { p.detail = v; p.updatedAt = nowIso(); },
          buildPrompt: function () {
            return buildRewritePrompt("Latest Feedback / Status Caption", p.name || "", projectFlagContext(p));
          }
        });
      }
    });
    ["risks", "onHold", "itRequests", "powerBi"].forEach(function (section) {
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
      " to Groq and replace each with an AI-reworded version. This cannot be undone automatically " +
      "(export a backup first if you want to be able to revert). Continue?"
    )) {
      return;
    }

    var originalLabel = button.textContent;
    button.disabled = true;
    var failures = [];
    var index = 0;

    function runNext() {
      if (index >= tasks.length) {
        button.disabled = false;
        button.textContent = originalLabel;
        saveData();
        renderList();
        showSelected();
        if (state.activeSection === "report") renderReportView();
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
    var btn = e.target.closest(".copy-category-btn");
    if (!btn) return;
    handleCopyCategoryBlock(btn.getAttribute("data-category"), btn);
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

  document.querySelector('.btn-rewrite[data-field="name"]').addEventListener("click", function (e) {
    handleRewriteProjectName(e.currentTarget);
  });
  document.querySelector('.btn-rewrite[data-field="detail"]').addEventListener("click", function (e) {
    handleRewriteProjectDetail(e.currentTarget);
  });
  document.getElementById("btnRewriteItem").addEventListener("click", function (e) {
    handleRewriteItem(e.currentTarget);
  });

  document.getElementById("btnEnhanceAll").addEventListener("click", function (e) {
    enhanceAllEntries(e.currentTarget);
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
