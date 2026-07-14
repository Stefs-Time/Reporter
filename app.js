(function () {
  "use strict";

  var STORAGE_KEY = "projectFeedbackTracker.projects";

  var SECTIONS = [
    { key: "highlights", label: "Key Highlights", inputId: "highlightsInput" },
    { key: "progress", label: "In Progress", inputId: "progressInput" },
    { key: "risks", label: "Risks", inputId: "risksInput" },
    { key: "onHold", label: "On Hold", inputId: "onHoldInput" },
    { key: "itRequests", label: "Support Requests Opened to IT", inputId: "itRequestsInput" },
    { key: "powerBi", label: "Open Help Desk Requests - Power BI Department", inputId: "powerBiInput" }
  ];

  var state = {
    projects: [],
    selectedId: null
  };

  function loadProjects() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      state.projects = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load saved data", e);
      state.projects = [];
    }
  }

  function saveProjects() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
  }

  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function linesToArray(text) {
    return (text || "")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  // ---- Rendering: sidebar list ----

  var projectListEl = document.getElementById("projectList");
  var searchBoxEl = document.getElementById("searchBox");

  function renderList() {
    var filter = (searchBoxEl.value || "").toLowerCase();
    var items = state.projects
      .filter(function (p) {
        return p.name.toLowerCase().indexOf(filter) !== -1 ||
          p.owner.toLowerCase().indexOf(filter) !== -1;
      })
      .sort(function (a, b) {
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      });

    projectListEl.innerHTML = "";

    items.forEach(function (p) {
      var li = document.createElement("li");
      if (p.id === state.selectedId) li.className = "active";
      li.innerHTML =
        '<div class="li-name"></div>' +
        '<div class="li-owner"></div>' +
        '<div class="li-updated"></div>';
      li.querySelector(".li-name").textContent = p.name;
      li.querySelector(".li-owner").textContent = p.owner;
      li.querySelector(".li-updated").textContent = p.updatedAt ? "Updated " + formatDate(p.updatedAt) : "";
      li.addEventListener("click", function () { selectProject(p.id); });
      projectListEl.appendChild(li);
    });

    if (items.length === 0) {
      var empty = document.createElement("li");
      empty.style.color = "#9aa0a6";
      empty.style.cursor = "default";
      empty.textContent = state.projects.length === 0 ? "No projects yet." : "No matches.";
      projectListEl.appendChild(empty);
    }
  }

  // ---- Editor form ----

  var emptyStateEl = document.getElementById("emptyState");
  var formEl = document.getElementById("projectForm");
  var fields = {
    id: document.getElementById("projectId"),
    owner: document.getElementById("ownerInput"),
    name: document.getElementById("nameInput"),
    detail: document.getElementById("detailInput"),
    highlights: document.getElementById("highlightsInput"),
    progress: document.getElementById("progressInput"),
    risks: document.getElementById("risksInput"),
    onHold: document.getElementById("onHoldInput"),
    itRequests: document.getElementById("itRequestsInput"),
    powerBi: document.getElementById("powerBiInput")
  };

  function selectProject(id) {
    state.selectedId = id;
    var project = state.projects.find(function (p) { return p.id === id; });

    if (!project) {
      formEl.hidden = true;
      emptyStateEl.hidden = false;
      renderList();
      return;
    }

    emptyStateEl.hidden = true;
    formEl.hidden = false;

    fields.id.value = project.id;
    fields.owner.value = project.owner || "";
    fields.name.value = project.name || "";
    fields.detail.value = project.detail || "";
    fields.highlights.value = project.highlights || "";
    fields.progress.value = project.progress || "";
    fields.risks.value = project.risks || "";
    fields.onHold.value = project.onHold || "";
    fields.itRequests.value = project.itRequests || "";
    fields.powerBi.value = project.powerBi || "";

    renderList();
  }

  function newProject() {
    var project = {
      id: uid(),
      owner: "",
      name: "",
      detail: "",
      highlights: "",
      progress: "",
      risks: "",
      onHold: "",
      itRequests: "",
      powerBi: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.projects.push(project);
    saveProjects();
    selectProject(project.id);
    fields.owner.focus();
  }

  function handleSave(e) {
    e.preventDefault();
    var id = fields.id.value;
    var project = state.projects.find(function (p) { return p.id === id; });
    if (!project) return;

    project.owner = fields.owner.value.trim();
    project.name = fields.name.value.trim();
    project.detail = fields.detail.value.trim();
    project.highlights = fields.highlights.value;
    project.progress = fields.progress.value;
    project.risks = fields.risks.value;
    project.onHold = fields.onHold.value;
    project.itRequests = fields.itRequests.value;
    project.powerBi = fields.powerBi.value;
    project.updatedAt = new Date().toISOString();

    saveProjects();
    renderList();
  }

  function handleDelete() {
    var id = fields.id.value;
    var project = state.projects.find(function (p) { return p.id === id; });
    if (!project) return;
    if (!confirm('Delete project "' + project.name + '"? This cannot be undone.')) return;

    state.projects = state.projects.filter(function (p) { return p.id !== id; });
    state.selectedId = null;
    saveProjects();
    selectProject(null);
  }

  // ---- Print ----

  var printAreaEl = document.getElementById("printArea");

  function buildSectionHtml(project) {
    return SECTIONS.map(function (section) {
      var items = linesToArray(project[section.key]);
      var body = items.length
        ? "<ul>" + items.map(function (i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("") + "</ul>"
        : '<div class="none">None reported</div>';
      return '<div class="print-section"><h3>' + escapeHtml(section.label) + "</h3>" + body + "</div>";
    }).join("");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function buildCardHtml(project) {
    var detailHtml = project.detail
      ? "<div class=\"print-detail\">" + escapeHtml(project.detail) + "</div>"
      : "";
    return (
      '<div class="print-card">' +
      "<h2>" + escapeHtml(project.name || "Untitled Project") + "</h2>" +
      '<div class="print-meta">Owner: ' + escapeHtml(project.owner || "Unassigned") +
      " &nbsp;|&nbsp; Last updated: " + formatDate(project.updatedAt) + "</div>" +
      detailHtml +
      buildSectionHtml(project) +
      "</div>"
    );
  }

  function printProject(id) {
    var project = state.projects.find(function (p) { return p.id === id; });
    if (!project) return;
    printAreaEl.innerHTML =
      '<h1 style="font-size:20px;margin-bottom:16px;">Project Feedback Report</h1>' +
      buildCardHtml(project);
    window.print();
  }

  function printAll() {
    if (state.projects.length === 0) {
      alert("There are no projects to print yet.");
      return;
    }
    var sorted = state.projects.slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
    var html =
      '<h1 style="font-size:20px;margin-bottom:16px;">Project Feedback Report - ' +
      new Date().toLocaleDateString() +
      "</h1>";
    html += sorted.map(buildCardHtml).join("");
    printAreaEl.innerHTML = html;
    window.print();
  }

  // ---- Export / Import ----

  function exportData() {
    var blob = new Blob([JSON.stringify(state.projects, null, 2)], { type: "application/json" });
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
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("Invalid file format");
        var valid = data.every(function (p) { return p && typeof p === "object" && p.id; });
        if (!valid) throw new Error("Invalid project data");

        if (state.projects.length > 0) {
          if (!confirm("Importing will replace all " + state.projects.length + " existing project(s). Continue?")) {
            return;
          }
        }
        state.projects = data;
        state.selectedId = null;
        saveProjects();
        selectProject(null);
      } catch (e) {
        alert("Could not import file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---- Wiring ----

  document.getElementById("btnNewProject").addEventListener("click", newProject);
  document.getElementById("btnPrintAll").addEventListener("click", printAll);
  document.getElementById("btnPrintOne").addEventListener("click", function () {
    if (state.selectedId) printProject(state.selectedId);
  });
  document.getElementById("btnDelete").addEventListener("click", handleDelete);
  document.getElementById("btnExport").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });
  formEl.addEventListener("submit", handleSave);
  searchBoxEl.addEventListener("input", renderList);

  // ---- Init ----

  loadProjects();
  renderList();
  selectProject(null);
})();
