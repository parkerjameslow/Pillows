import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { SEED_TASKS } from "./seed.js";

// ─── Firebase config ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCk2rQwoQIz_CSetxH_x5yXwX9ge-ofKtE",
  authDomain: "pillows-86314.firebaseapp.com",
  projectId: "pillows-86314",
  storageBucket: "pillows-86314.firebasestorage.app",
  messagingSenderId: "530067542567",
  appId: "1:530067542567:web:712c9a836a0949d7e8f402",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const showsRef     = collection(db, "shows");
const activeRef    = doc(db, "meta", "active");

// ─── Constants ───────────────────────────────────────────────────
const PEOPLE = ["Addie", "Brooks", "Race", "Heidi", "Parker", "Finn"];

const PERSON_COLORS = {
  Addie:  "#F46B6B",
  Brooks: "#5B9BFF",
  Race:   "#3DD68C",
  Heidi:  "#B66BFF",
  Parker: "#7B6BFF",
  Finn:   "#F4B86B",
};

const PHASES = [
  { id: "pre",      label: "Pre Show" },
  { id: "setup",    label: "Setup" },
  { id: "during",   label: "During Show" },
  { id: "takedown", label: "Take Down" },
];

// ─── State ───────────────────────────────────────────────────────
let allShows         = [];
let activeShowId     = null;
let activeShowTasks  = [];
let tasksUnsub       = null;
let pendingAssign    = null;

// ─── DOM refs ────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const tasksContainer  = $("tasks-container");
const phaseStats      = $("phase-stats");
const status          = $("connection-status");
const noShowEmpty     = $("no-show-empty");
const noShowsEmpty    = $("no-shows-empty");
const activeShowName  = $("active-show-name");
const activeShowDate  = $("active-show-date");
const earningsShowName = $("earnings-show-name");
const addTaskBtn      = $("add-task-btn");

const showsContainer  = $("shows-container");
const addShowBtn      = $("add-show-btn");
const showSheet       = $("show-sheet");
const showForm        = $("show-form");
const showCancel      = $("show-cancel");
const showDelete      = $("show-delete");

const assignSheet    = $("assign-sheet");
const assignList     = $("assign-list");
const sheetTitle     = $("sheet-title");
const sheetSubtitle  = $("sheet-subtitle");
const sheetTotal     = $("sheet-total");
const sheetCancel    = $("sheet-cancel");
const sheetConfirm   = $("sheet-confirm");

const addSheet       = $("add-sheet");
const addBtn         = $("add-task-btn");
const addCancel      = $("add-cancel");
const addForm        = $("add-form");

const earningsSummary = $("earnings-summary");
const peopleList      = $("people-list");

// ─── Init ────────────────────────────────────────────────────────
setupNav();
setupSheets();
setupAddTask();
setupNewShow();

// Subscribe to shows list
onSnapshot(
  query(showsRef, orderBy("startDate", "asc")),
  (snap) => {
    allShows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderShows();
    renderActiveHeader();
  },
  (err) => {
    status.textContent = `Error loading shows: ${err.message}`;
    console.error(err);
  }
);

// Subscribe to "active show" pointer
onSnapshot(
  activeRef,
  (snap) => {
    const newId = snap.exists() ? snap.data().showId : null;
    if (newId !== activeShowId) {
      activeShowId = newId;
      subscribeToActiveTasks();
      renderActiveHeader();
      renderShows();
    }
  },
  (err) => console.error("active show err:", err)
);

// ─── Active show subscription ────────────────────────────────────
function subscribeToActiveTasks() {
  if (tasksUnsub) tasksUnsub();
  tasksUnsub = null;

  if (!activeShowId) {
    activeShowTasks = [];
    renderTasks();
    renderEarnings();
    status.textContent = "No active show";
    return;
  }

  const tasksRef = collection(db, "shows", activeShowId, "tasks");
  tasksUnsub = onSnapshot(
    query(tasksRef, orderBy("order", "asc")),
    (snap) => {
      activeShowTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      status.textContent = `Live · ${activeShowTasks.length} task${activeShowTasks.length === 1 ? "" : "s"}`;
      renderTasks();
      renderEarnings();
      renderShows();
    },
    (err) => {
      status.textContent = `Error: ${err.message}`;
      console.error(err);
    }
  );
}

// ─── Header on Tasks screen ──────────────────────────────────────
function renderActiveHeader() {
  const show = allShows.find((s) => s.id === activeShowId);
  if (!show) {
    activeShowName.textContent = "No show selected";
    activeShowDate.textContent = "Create one in the Shows tab";
    earningsShowName.textContent = "No active show";
    addTaskBtn.style.display = "none";
    return;
  }
  activeShowName.textContent = show.name;
  activeShowDate.textContent = formatDateRange(show.startDate, show.endDate);
  earningsShowName.textContent = show.name;
  addTaskBtn.style.display = "";
}

// ─── Tasks screen render ─────────────────────────────────────────
function renderTasks() {
  if (!activeShowId) {
    noShowEmpty.classList.remove("hidden");
    tasksContainer.innerHTML = "";
    phaseStats.innerHTML = "";
    return;
  }
  noShowEmpty.classList.add("hidden");

  // Phase stat tiles
  phaseStats.innerHTML = PHASES.map((p) => {
    const tasks = activeShowTasks.filter((t) => t.phase === p.id);
    const done = tasks.filter((t) => t.done).length;
    return `
      <div class="stat-card">
        <div class="stat-num ${p.id}">${done}/${tasks.length}</div>
        <div class="stat-label">${p.label}</div>
      </div>
    `;
  }).join("");

  tasksContainer.innerHTML = "";
  for (const p of PHASES) {
    const tasks = activeShowTasks.filter((t) => t.phase === p.id);
    if (tasks.length === 0) continue;

    const section = document.createElement("div");
    section.className = "section-block";
    section.innerHTML = `<h2 class="section-header">${p.label}</h2>`;

    for (const t of tasks) {
      section.appendChild(renderTaskCard(t));
    }
    tasksContainer.appendChild(section);
  }
}

function renderTaskCard(t) {
  const card = document.createElement("div");
  card.className = "task-card" + (t.done ? " done" : "");

  const boutiqueTag = t.boutique
    ? `<span class="boutique-tag ${t.boutique}">${t.boutique}</span>`
    : "";

  const assignedChips = t.assignments && Object.keys(t.assignments).length
    ? `<div class="assigned">${
        Object.entries(t.assignments)
          .map(([name, pct]) => `<span class="assigned-chip">${name} ${pct}%</span>`)
          .join("")
      }</div>`
    : "";

  card.innerHTML = `
    <div class="task-check">${t.done ? "✓" : ""}</div>
    <div class="task-body">
      <p class="task-title">${escapeHtml(t.title)}</p>
      <div class="task-meta">
        <span class="pay-tag">$${t.pay}</span>
        ${boutiqueTag}
        ${assignedChips}
      </div>
    </div>
  `;

  card.addEventListener("click", () => {
    if (t.done) {
      if (confirm(`Unmark "${t.title}" as done? This will remove its earnings.`)) {
        updateDoc(doc(db, "shows", activeShowId, "tasks", t.id), {
          done: false,
          assignments: {},
          completedAt: null,
        });
      }
    } else {
      openAssignSheet(t);
    }
  });

  return card;
}

// ─── Assignment sheet ────────────────────────────────────────────
function openAssignSheet(task) {
  pendingAssign = { taskId: task.id, selections: {} };
  sheetTitle.textContent = task.title;
  sheetSubtitle.textContent = `$${task.pay} · pick who helped & set %`;

  assignList.innerHTML = "";
  PEOPLE.forEach((name) => {
    const li = document.createElement("li");
    li.className = "assign-row";
    li.innerHTML = `
      <input type="checkbox" id="chk-${name}" data-name="${name}" />
      <label for="chk-${name}" class="assign-name">${name}</label>
      <input class="assign-pct" type="number" min="0" max="100" step="1"
             data-name="${name}" placeholder="0" disabled />
      <span class="pct-suffix">%</span>
    `;
    assignList.appendChild(li);
  });

  assignList.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
    chk.addEventListener("change", () => {
      const name = chk.dataset.name;
      if (chk.checked) pendingAssign.selections[name] = 0;
      else delete pendingAssign.selections[name];
      redistributeEvenly();
      syncAssignUI();
    });
  });

  assignList.querySelectorAll(".assign-pct").forEach((inp) => {
    inp.addEventListener("input", () => {
      const name = inp.dataset.name;
      const v = parseInt(inp.value, 10);
      pendingAssign.selections[name] = isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
      validateTotal();
    });
  });

  syncAssignUI();
  assignSheet.classList.remove("hidden");
}

function redistributeEvenly() {
  const names = Object.keys(pendingAssign.selections);
  if (names.length === 0) return;
  const each = Math.floor(100 / names.length);
  const remainder = 100 - each * names.length;
  names.forEach((n, i) => {
    pendingAssign.selections[n] = each + (i < remainder ? 1 : 0);
  });
}

function syncAssignUI() {
  assignList.querySelectorAll(".assign-row").forEach((row) => {
    const chk = row.querySelector('input[type="checkbox"]');
    const inp = row.querySelector(".assign-pct");
    const name = chk.dataset.name;
    const selected = name in pendingAssign.selections;
    row.classList.toggle("selected", selected);
    chk.checked = selected;
    inp.disabled = !selected;
    inp.value = selected ? pendingAssign.selections[name] : "";
  });
  validateTotal();
}

function validateTotal() {
  const total = Object.values(pendingAssign.selections)
    .reduce((s, v) => s + (Number(v) || 0), 0);
  sheetTotal.textContent = `Total: ${total}%`;
  sheetTotal.className = "sheet-total " + (
    total === 100 ? "ok" : total === 0 ? "" : "error"
  );
  sheetConfirm.disabled = !(total === 100 && Object.keys(pendingAssign.selections).length > 0);
}

sheetCancel.addEventListener("click", closeAssignSheet);
assignSheet.addEventListener("click", (e) => {
  if (e.target === assignSheet) closeAssignSheet();
});

sheetConfirm.addEventListener("click", async () => {
  if (!pendingAssign || !activeShowId) return;
  await updateDoc(doc(db, "shows", activeShowId, "tasks", pendingAssign.taskId), {
    done: true,
    assignments: pendingAssign.selections,
    completedAt: serverTimestamp(),
  });
  closeAssignSheet();
});

function closeAssignSheet() {
  assignSheet.classList.add("hidden");
  pendingAssign = null;
}

// ─── Earnings (scoped to active show) ────────────────────────────
function renderEarnings() {
  const totals = {};
  PEOPLE.forEach((p) => totals[p] = { earned: 0, tasks: 0 });

  let pool = 0, paidOut = 0;
  for (const t of activeShowTasks) {
    pool += Number(t.pay) || 0;
    if (t.done && t.assignments) {
      for (const [name, pct] of Object.entries(t.assignments)) {
        if (totals[name]) {
          totals[name].earned += (Number(t.pay) || 0) * (Number(pct) / 100);
          totals[name].tasks  += 1;
        }
      }
      paidOut += Number(t.pay) || 0;
    }
  }

  earningsSummary.innerHTML = `
    <p class="label">Paid out so far</p>
    <p class="amount">$${paidOut.toFixed(0)}</p>
    <p class="sub">of $${pool.toFixed(0)} total · $${(pool - paidOut).toFixed(0)} remaining</p>
  `;

  const sorted = PEOPLE.slice().sort((a, b) => totals[b].earned - totals[a].earned);
  peopleList.innerHTML = sorted.map((name) => {
    const { earned, tasks } = totals[name];
    return `
      <div class="person-card">
        <div class="person-name">
          <span class="avatar" style="background: ${PERSON_COLORS[name]}">${name[0]}</span>
          <div>
            ${name}
            <span class="person-tasks">${tasks} task${tasks === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="person-amount">$${earned.toFixed(2)}</div>
      </div>
    `;
  }).join("");
}

// ─── Shows screen render ─────────────────────────────────────────
function renderShows() {
  if (allShows.length === 0) {
    noShowsEmpty.classList.remove("hidden");
    showsContainer.innerHTML = "";
    return;
  }
  noShowsEmpty.classList.add("hidden");

  const today = todayISO();
  const active = [], upcoming = [], past = [];
  for (const s of allShows) {
    if (s.id === activeShowId) {
      active.push(s);
    } else if ((s.endDate || s.startDate) >= today) {
      upcoming.push(s);
    } else {
      past.push(s);
    }
  }
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b) => b.startDate.localeCompare(a.startDate));

  showsContainer.innerHTML = "";
  if (active.length) showsContainer.appendChild(showSection("Active", active, "active"));
  if (upcoming.length) showsContainer.appendChild(showSection("Upcoming", upcoming, "upcoming"));
  if (past.length) showsContainer.appendChild(showSection("Past", past, "past"));
}

function showSection(label, shows, statusClass) {
  const section = document.createElement("div");
  section.className = "section-block";
  section.innerHTML = `<h2 class="section-header">${label}</h2>`;
  for (const s of shows) {
    section.appendChild(renderShowCard(s, statusClass));
  }
  return section;
}

function renderShowCard(s, statusClass) {
  const card = document.createElement("div");
  card.className = "show-card" + (s.id === activeShowId ? " active" : "");

  // For the active show, show progress + payout from loaded tasks
  let metaHtml = "";
  if (s.id === activeShowId && activeShowTasks.length) {
    const done = activeShowTasks.filter((t) => t.done).length;
    const pool = activeShowTasks.reduce((sum, t) => sum + (Number(t.pay) || 0), 0);
    const paid = activeShowTasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (Number(t.pay) || 0), 0);
    metaHtml = `
      <div class="show-card-meta">
        <span class="progress">${done}/${activeShowTasks.length} tasks</span>
        <span class="payout">$${paid} / $${pool}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="show-card-top">
      <div>
        <p class="show-card-name">${escapeHtml(s.name)}</p>
        <p class="show-card-dates">${formatDateRange(s.startDate, s.endDate)}</p>
      </div>
      <span class="show-status ${statusClass}">${statusClass}</span>
    </div>
    ${metaHtml}
  `;

  card.addEventListener("click", async () => {
    if (s.id === activeShowId) {
      // Already active — switch to Tasks tab
      switchTab("tasks");
    } else {
      await setDoc(activeRef, { showId: s.id });
      switchTab("tasks");
    }
  });

  return card;
}

// ─── New show creation ──────────────────────────────────────────
function setupNewShow() {
  addShowBtn.addEventListener("click", () => {
    showForm.reset();
    $("show-start").value = todayISO();
    $("show-seed").checked = true;
    showSheet.classList.remove("hidden");
  });
  showCancel.addEventListener("click", () => showSheet.classList.add("hidden"));

  showSheet.addEventListener("click", (e) => {
    if (e.target === showSheet) showSheet.classList.add("hidden");
  });

  showForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name      = $("show-name").value.trim();
    const startDate = $("show-start").value;
    const endDate   = $("show-end").value || startDate;
    const seedIt    = $("show-seed").checked;
    if (!name || !startDate) return;

    const submitBtn = $("show-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating…";

    try {
      const showDoc = await addDoc(showsRef, {
        name, startDate, endDate,
        createdAt: serverTimestamp(),
      });

      if (seedIt) {
        const batch = writeBatch(db);
        SEED_TASKS.forEach((t, i) => {
          const taskRef = doc(collection(db, "shows", showDoc.id, "tasks"));
          batch.set(taskRef, {
            ...t,
            order: i,
            done: false,
            assignments: {},
            completedAt: null,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      await setDoc(activeRef, { showId: showDoc.id });
      showSheet.classList.add("hidden");
      switchTab("tasks");
    } catch (err) {
      alert("Couldn't create show: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Show";
    }
  });
}

// ─── Bottom nav ──────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.target));
  });
}

function switchTab(target) {
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.target === target));
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("hidden", s.dataset.screen !== target));
  window.scrollTo({ top: 0 });
}

// ─── Sheets backdrop close ───────────────────────────────────────
function setupSheets() {
  addSheet.addEventListener("click", (e) => {
    if (e.target === addSheet) addSheet.classList.add("hidden");
  });
}

// ─── Add task ────────────────────────────────────────────────────
function setupAddTask() {
  addBtn.addEventListener("click", () => {
    if (!activeShowId) {
      alert("Pick or create a show first (Shows tab).");
      return;
    }
    addSheet.classList.remove("hidden");
  });
  addCancel.addEventListener("click", () => addSheet.classList.add("hidden"));

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeShowId) return;
    const title    = $("new-title").value.trim();
    const pay      = parseInt($("new-pay").value, 10) || 0;
    const phase    = $("new-phase").value;
    const boutique = $("new-boutique").value || null;
    if (!title) return;

    const maxOrder = activeShowTasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    await addDoc(collection(db, "shows", activeShowId, "tasks"), {
      title, pay, phase, boutique,
      order: maxOrder + 1,
      done: false,
      assignments: {},
      completedAt: null,
      createdAt: serverTimestamp(),
    });

    addForm.reset();
    addSheet.classList.add("hidden");
  });
}

// ─── Helpers ─────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateRange(start, end) {
  if (!start) return "";
  const s = new Date(start + "T00:00:00");
  if (!end || end === start) {
    return s.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const month = s.toLocaleDateString(undefined, { month: "long" });
    return `${month} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
