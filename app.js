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
let pendingAssign    = null;
const allShowsTasks  = new Map(); // showId -> tasks[]
const showTaskSubs   = new Map(); // showId -> unsub fn

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

const showEarningsSheet    = $("show-earnings-sheet");
const showEarningsTitle    = $("show-earnings-title");
const showEarningsSubtitle = $("show-earnings-subtitle");
const showEarningsList     = $("show-earnings-list");
const showEarningsTotal    = $("show-earnings-total");
const showEarningsClose    = $("show-earnings-close");

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
    syncShowTaskSubs();
    renderShows();
    renderActiveHeader();
    renderEarnings();
    refreshShowEarningsSheetIfOpen();
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
      activeShowTasks = activeShowId ? (allShowsTasks.get(activeShowId) || []) : [];
      renderActiveHeader();
      renderTasks();
      renderShows();
      renderEarnings();
      updateStatus();
    }
  },
  (err) => console.error("active show err:", err)
);

// ─── Per-show task subscriptions ─────────────────────────────────
function syncShowTaskSubs() {
  const liveIds = new Set(allShows.map((s) => s.id));
  // Tear down subs for shows that disappeared
  for (const [id, unsub] of showTaskSubs) {
    if (!liveIds.has(id)) {
      unsub();
      showTaskSubs.delete(id);
      allShowsTasks.delete(id);
    }
  }
  // Subscribe to any new shows
  for (const s of allShows) {
    if (showTaskSubs.has(s.id)) continue;
    const tasksRef = collection(db, "shows", s.id, "tasks");
    const unsub = onSnapshot(
      query(tasksRef, orderBy("order", "asc")),
      (snap) => {
        const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        allShowsTasks.set(s.id, tasks);
        if (s.id === activeShowId) {
          activeShowTasks = tasks;
          updateStatus();
          renderTasks();
        }
        renderShows();
        renderEarnings();
        refreshShowEarningsSheetIfOpen();
      },
      (err) => console.error(`tasks err for ${s.id}:`, err)
    );
    showTaskSubs.set(s.id, unsub);
  }
}

function updateStatus() {
  if (!activeShowId) {
    status.textContent = "No active show";
    return;
  }
  const n = activeShowTasks.length;
  status.textContent = `Live · ${n} task${n === 1 ? "" : "s"}`;
}

// ─── Header on Tasks screen ──────────────────────────────────────
function renderActiveHeader() {
  const show = allShows.find((s) => s.id === activeShowId);
  if (!show) {
    activeShowName.textContent = "No show selected";
    activeShowDate.textContent = "Create one in the Shows tab";
    addTaskBtn.style.display = "none";
    return;
  }
  activeShowName.textContent = show.name;
  activeShowDate.textContent = formatDateRange(show.startDate, show.endDate);
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

// ─── Earnings (cross-show, with paid/pending) ────────────────────
function computeShowTotals(showId) {
  const tasks = allShowsTasks.get(showId) || [];
  const totals = {};
  PEOPLE.forEach((p) => totals[p] = 0);
  for (const t of tasks) {
    if (t.done && t.assignments) {
      for (const [name, pct] of Object.entries(t.assignments)) {
        if (totals[name] !== undefined) {
          totals[name] += (Number(t.pay) || 0) * (Number(pct) / 100);
        }
      }
    }
  }
  return totals;
}

function renderEarnings() {
  const perPerson = {};
  PEOPLE.forEach((p) => perPerson[p] = { earned: 0, paid: 0, pending: 0, shows: new Set() });

  for (const show of allShows) {
    const showTotals = computeShowTotals(show.id);
    const paidMap = show.paid || {};
    for (const name of PEOPLE) {
      const amt = showTotals[name];
      if (amt > 0) {
        perPerson[name].earned += amt;
        perPerson[name].shows.add(show.id);
        if (paidMap[name]) perPerson[name].paid += amt;
        else perPerson[name].pending += amt;
      }
    }
  }

  const grandEarned  = Object.values(perPerson).reduce((s, t) => s + t.earned, 0);
  const grandPaid    = Object.values(perPerson).reduce((s, t) => s + t.paid, 0);
  const grandPending = Object.values(perPerson).reduce((s, t) => s + t.pending, 0);

  earningsShowName.textContent = `Across ${allShows.length} show${allShows.length === 1 ? "" : "s"}`;

  earningsSummary.innerHTML = `
    <p class="label">Total earned</p>
    <p class="amount">$${grandEarned.toFixed(0)}</p>
    <p class="sub">$${grandPaid.toFixed(0)} paid · $${grandPending.toFixed(0)} pending</p>
  `;

  const sorted = PEOPLE.slice().sort((a, b) => perPerson[b].earned - perPerson[a].earned);
  peopleList.innerHTML = sorted.map((name) => {
    const t = perPerson[name];
    const showCount = t.shows.size;
    const tail = t.earned === 0
      ? `<div class="person-paid-tag" style="color: var(--text-muted);">No earnings</div>`
      : t.pending > 0
        ? `<div class="person-pending">$${t.pending.toFixed(2)} owed</div>`
        : `<div class="person-paid-tag">All paid ✓</div>`;
    return `
      <div class="person-card">
        <div class="person-name">
          <span class="avatar" style="background: ${PERSON_COLORS[name]}">${name[0]}</span>
          <div>
            ${name}
            <span class="person-tasks">${showCount} show${showCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="person-earnings">
          <div class="person-amount">$${t.earned.toFixed(2)}</div>
          ${tail}
        </div>
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

  const tasks = allShowsTasks.get(s.id) || [];
  let metaHtml = "";
  if (tasks.length) {
    const done = tasks.filter((t) => t.done).length;
    const pool = tasks.reduce((sum, t) => sum + (Number(t.pay) || 0), 0);
    const paid = tasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (Number(t.pay) || 0), 0);
    metaHtml = `
      <div class="show-card-meta">
        <span class="progress">${done}/${tasks.length} tasks</span>
        <span class="payout">$${paid} / $${pool}</span>
      </div>
    `;
  }

  // Earnings / paid status pill
  const showTotals = computeShowTotals(s.id);
  const paidMap = s.paid || {};
  let earnerCount = 0, pendingTotal = 0, paidTotal = 0;
  for (const name of PEOPLE) {
    if (showTotals[name] > 0) {
      earnerCount++;
      if (paidMap[name]) paidTotal += showTotals[name];
      else pendingTotal += showTotals[name];
    }
  }
  let earningsBtnHtml = "";
  if (earnerCount > 0) {
    const pill = pendingTotal > 0
      ? `<span class="pending-pill">$${pendingTotal.toFixed(0)} owed</span>`
      : `<span class="all-paid-pill">All paid ✓</span>`;
    earningsBtnHtml = `
      <button class="show-earnings-btn" type="button">
        <span>Earnings & pay status</span>
        ${pill}
      </button>
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
    ${earningsBtnHtml}
  `;

  card.addEventListener("click", async () => {
    if (s.id === activeShowId) {
      switchTab("tasks");
    } else {
      await setDoc(activeRef, { showId: s.id });
      switchTab("tasks");
    }
  });

  const earningsBtn = card.querySelector(".show-earnings-btn");
  if (earningsBtn) {
    earningsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openShowEarningsSheet(s.id);
    });
  }

  return card;
}

// ─── Show earnings / paid sheet ──────────────────────────────────
function openShowEarningsSheet(showId) {
  const show = allShows.find((s) => s.id === showId);
  if (!show) return;
  showEarningsSheet.dataset.showId = showId;
  renderShowEarningsSheet(showId);
  showEarningsSheet.classList.remove("hidden");
}

function renderShowEarningsSheet(showId) {
  const show = allShows.find((s) => s.id === showId);
  if (!show) return;
  const totals = computeShowTotals(showId);
  const paidMap = show.paid || {};

  showEarningsTitle.textContent = show.name;

  const earners = PEOPLE.filter((p) => totals[p] > 0);
  if (earners.length === 0) {
    showEarningsSubtitle.textContent = "No completed tasks yet for this show.";
    showEarningsList.innerHTML = `<li class="empty-row">No earnings to track.</li>`;
    showEarningsTotal.textContent = "";
    return;
  }

  showEarningsSubtitle.textContent = "Tap a person to mark them paid.";

  showEarningsList.innerHTML = earners.map((name) => {
    const isPaid = !!paidMap[name];
    return `
      <li class="paid-row ${isPaid ? "paid" : ""}" data-name="${name}">
        <span class="avatar" style="background: ${PERSON_COLORS[name]}">${name[0]}</span>
        <div class="paid-row-body">
          <p class="paid-row-name">${name}</p>
          <p class="paid-row-amt">$${totals[name].toFixed(2)}</p>
        </div>
        <input type="checkbox" class="paid-check" ${isPaid ? "checked" : ""} />
      </li>
    `;
  }).join("");

  const totalEarned  = earners.reduce((s, n) => s + totals[n], 0);
  const totalPaid    = earners.reduce((s, n) => s + (paidMap[n] ? totals[n] : 0), 0);
  const totalPending = totalEarned - totalPaid;
  showEarningsTotal.textContent = `Paid $${totalPaid.toFixed(2)} · Pending $${totalPending.toFixed(2)}`;
  showEarningsTotal.className = "sheet-total " + (totalPending === 0 ? "ok" : "");

  showEarningsList.querySelectorAll(".paid-row").forEach((row) => {
    row.addEventListener("click", async () => {
      const name = row.dataset.name;
      const currentShow = allShows.find((s) => s.id === showId);
      const currentPaid = { ...(currentShow?.paid || {}) };
      if (currentPaid[name]) delete currentPaid[name];
      else currentPaid[name] = true;
      await updateDoc(doc(db, "shows", showId), { paid: currentPaid });
    });
  });
}

function refreshShowEarningsSheetIfOpen() {
  if (showEarningsSheet.classList.contains("hidden")) return;
  const showId = showEarningsSheet.dataset.showId;
  if (showId) renderShowEarningsSheet(showId);
}

showEarningsClose.addEventListener("click", () => {
  showEarningsSheet.classList.add("hidden");
});
showEarningsSheet.addEventListener("click", (e) => {
  if (e.target === showEarningsSheet) showEarningsSheet.classList.add("hidden");
});

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
