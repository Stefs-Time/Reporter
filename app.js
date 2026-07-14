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

  function linesToArray(text) {
    return (text || "")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  // ---- Sidebar nav ----

  var navButtons = document.querySelectorAll(".nav-btn");
  var searchBoxEl = document.getElementById("searchBox");
  var itemListEl = document.getElementById("itemList");
  var btnNewItem = document.getElementById("btnNewItem");

  var sidebarListSectionEl = document.getElementById("sidebarListSection");
  var reportViewEl = document.getElementById("reportView");
  var galleryViewEl = document.getElementById("galleryView");

  function sectionTitle(section) {
    return section === "projects" ? "Projects" : ITEM_SECTIONS[section].listLabel;
  }

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

  // ---- Gallery (tiles in the main pane when nothing is selected) ----

  function buildProjectTile(p) {
    var tile = document.createElement("div");
    tile.className = "gallery-tile";

    var badges = "";
    if (p.flagHighlight) badges += '<span class="badge badge-highlight">Highlight</span>';
    if (p.flagRisk) badges += '<span class="badge badge-risk">At Risk</span>';
    if (p.flagOnHold) badges += '<span class="badge badge-onhold">On Hold</span>';

    var points = linesToArray(p.detail);
    var pointsHtml = points.length
      ? '<ul class="tile-points">' + points.map(function (pt) {
          return "<li>" + escapeHtml(pt) + "</li>";
        }).join("") + "</ul>"
      : '<div class="tile-empty">No status caption yet.</div>';

    tile.innerHTML =
      '<div class="tile-title"></div>' +
      '<div class="tile-owner"></div>' +
      (badges ? '<div class="tile-badges">' + badges + "</div>" : "") +
      pointsHtml;
    tile.querySelector(".tile-title").textContent = projectDisplayName(p);
    tile.querySelector(".tile-owner").textContent = p.owner || "Unassigned";
    tile.addEventListener("click", function () { openProject(p.id); });
    return tile;
  }

  function buildItemTile(item, section) {
    var tile = document.createElement("div");
    tile.className = "gallery-tile";
    var linked = item.projectId ? findProject(item.projectId) : null;
    tile.innerHTML =
      '<div class="tile-text"></div>' +
      (linked ? '<div class="tile-linked"></div>' : "");
    tile.querySelector(".tile-text").textContent = item.text || "(empty)";
    if (linked) tile.querySelector(".tile-linked").textContent = "Project: " + projectDisplayName(linked);
    tile.addEventListener("click", function () { selectItem(item.id); });
    return tile;
  }

  function galleryTilesFor(section, filter) {
    var tiles = [];

    function projectMatches(p) {
      return p.name.toLowerCase().indexOf(filter) !== -1 ||
        p.owner.toLowerCase().indexOf(filter) !== -1;
    }
    function itemMatches(item) {
      return item.text.toLowerCase().indexOf(filter) !== -1;
    }

    if (section === "projects") {
      state.data.projects
        .slice()
        .filter(projectMatches)
        .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
        .forEach(function (p) { tiles.push(buildProjectTile(p)); });
      return tiles;
    }

    // Risks / On Hold also surface flagged projects; all four surface their own items.
    var flagKey = section === "risks" ? "flagRisk" : (section === "onHold" ? "flagOnHold" : null);
    if (flagKey) {
      state.data.projects
        .slice()
        .filter(function (p) { return p[flagKey] && projectMatches(p); })
        .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
        .forEach(function (p) { tiles.push(buildProjectTile(p)); });
    }

    currentArray(section)
      .slice()
      .filter(itemMatches)
      .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
      .forEach(function (item) { tiles.push(buildItemTile(item, section)); });

    return tiles;
  }

  function renderGallery() {
    var section = state.activeSection;
    var filter = (searchBoxEl.value || "").toLowerCase();
    var tiles = galleryTilesFor(section, filter);

    galleryViewEl.innerHTML = "";

    if (tiles.length === 0) {
      galleryViewEl.hidden = true;
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;
    galleryViewEl.hidden = false;

    var title = document.createElement("h2");
    title.className = "gallery-title";
    title.textContent = sectionTitle(section) + " (" + tiles.length + ")";
    galleryViewEl.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "gallery-grid";
    tiles.forEach(function (t) { grid.appendChild(t); });
    galleryViewEl.appendChild(grid);
  }

  function openProject(id) {
    if (state.activeSection !== "projects") {
      setActiveSection("projects");
    }
    selectItem(id);
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
      galleryViewEl.hidden = true;
      reportViewEl.hidden = false;
      return;
    }
    reportViewEl.hidden = true;

    if (!id) {
      projectFormEl.hidden = true;
      itemFormEl.hidden = true;
      renderGallery();
      return;
    }

    emptyStateEl.hidden = true;
    galleryViewEl.hidden = true;

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
      var heading = "<strong>" + escapeHtml(projectDisplayName(p)) + "</strong>";
      var points = linesToArray(p.detail);
      if (points.length === 0) return "<li>" + heading + "</li>";
      if (points.length === 1) return "<li>" + heading + " — " + escapeHtml(points[0]) + "</li>";
      var nested = "<ul>" + points.map(function (pt) { return "<li>" + escapeHtml(pt) + "</li>"; }).join("") + "</ul>";
      return "<li>" + heading + nested + "</li>";
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
      var points = linesToArray(p.detail);
      if (points.length <= 1) {
        return "- " + projectDisplayName(p) + (points.length ? ": " + points[0] : "");
      }
      return "- " + projectDisplayName(p) + "\n" +
        points.map(function (pt) { return "  - " + pt; }).join("\n");
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
    ["risks", "onHold", "itRequests", "powerBi"].forEach(function (section) {
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
        state.selectedId = null;
        saveData();
        setActiveSection("projects");
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

  var VOICE_RULE =
    "Write in a semi-humanized but still corporate voice — like a capable colleague giving a status " +
    "update out loud, not a press release or robotic corporate-speak. Avoid stiff filler phrases " +
    "(e.g. \"in order to\", \"it is important to note\", \"moving forward\") and avoid buzzword-stuffing, " +
    "but keep it professional and fit for a business audience.";

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
      "fits the source text, and keep enough concrete detail (what changed, what's blocking, what's " +
      "next) that each point stands on its own for someone reading it before the meeting."
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
    parts.push(NO_INVENTING_RULE);
    parts.push("Do not pad it with filler, and do not add bullet characters or numbering.");
    parts.push("Return only the rewritten text, with no preamble, commentary, or quotation marks.");
    return parts.join(" ");
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

  function buildShortcodePrompt() {
    return "You are creating a short project shortcode for a status report. From the project name " +
      "given below, produce a concise uppercase abbreviation of 2 to 5 characters (letters, optionally " +
      "with a digit, but no spaces or punctuation) that a reader could use to refer to the project — " +
      "typically the initials of its main words. Derive it only from the given project name; do not " +
      "introduce unrelated words or invent a different name. Return only the shortcode, nothing else.";
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

  function handleRewriteProjectName(button) {
    runRewriteGeneric(button, buildTitleRewritePrompt(projectFields.owner.value.trim()),
      projectFields.name.value, function (v) { projectFields.name.value = v; });
  }

  function handleRewriteShortcode(button) {
    runRewriteGeneric(button, buildShortcodePrompt(), projectFields.name.value,
      function (v) { projectFields.shortcode.value = sanitizeShortcode(v); });
  }

  function handleRewriteProjectDetail(button) {
    var project = findProject(projectFields.id.value);
    var systemPrompt = buildRewritePrompt(
      "Latest Feedback / Status Caption",
      projectFields.name.value.trim(),
      project ? projectFlagContext(project) : "",
      true
    );
    runRewriteGeneric(button, systemPrompt, projectFields.detail.value,
      function (v) { projectFields.detail.value = v; });
  }

  function handleRewriteItem(button) {
    var sectionInfo = ITEM_SECTIONS[itemFields.section.value];
    var linkedName = "";
    if (itemFields.projectLink.value) {
      var linked = findProject(itemFields.projectLink.value);
      if (linked) linkedName = linked.name;
    }
    var systemPrompt = buildRewritePrompt(sectionInfo.label, linkedName, "");
    runRewriteGeneric(button, systemPrompt, itemFields.text.value,
      function (v) { itemFields.text.value = v; });
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
  searchBoxEl.addEventListener("input", function () {
    renderList();
    if (!state.selectedId && state.activeSection !== "report") renderGallery();
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

  projectFormEl.addEventListener("submit", handleSaveProject);
  document.getElementById("btnDeleteProject").addEventListener("click", handleDeleteProject);

  itemFormEl.addEventListener("submit", handleSaveItem);
  document.getElementById("btnDeleteItem").addEventListener("click", handleDeleteItem);

  document.querySelector('.btn-rewrite[data-field="name"]').addEventListener("click", function (e) {
    handleRewriteProjectName(e.currentTarget);
  });
  document.querySelector('.btn-rewrite[data-field="shortcode"]').addEventListener("click", function (e) {
    handleRewriteShortcode(e.currentTarget);
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
