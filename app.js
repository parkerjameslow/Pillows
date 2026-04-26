import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { SEED_TASKS } from "./seed.js";

// ─── Firebase config ─────────────────────────────────────────────
// Replace these with the values from your Firebase console (see SETUP.md).
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksRef = collection(db, "tasks");

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
let allTasks = [];      // { id, title, phase, boutique, pay, order, done, assignments, completedAt }
let pendingAssign = null; // { taskId, selections: {name: pct} }

// ─── DOM refs ────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const tasksContainer = $("tasks-container");
const phaseStats     = $("phase-stats");
const status         = $("connection-status");
const seedBanner     = $("seed-banner");
const todayDate      = $("today-date");

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
todayDate.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric",
});

setupNav();
setupSheets();
setupAddTask();
$("seed-btn").addEventListener("click", seedDefaults);

// ─── Live data subscription ──────────────────────────────────────
const q = query(tasksRef, orderBy("order", "asc"));
onSnapshot(
  q,
  (snap) => {
    allTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    status.textContent = `Live · ${allTasks.length} task${allTasks.length === 1 ? "" : "s"}`;
    seedBanner.classList.toggle("hidden", allTasks.length > 0);
    renderTasks();
    renderEarnings();
  },
  (err) => {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }
);

// ─── Tasks screen render ─────────────────────────────────────────
function renderTasks() {
  // Phase stat tiles
  phaseStats.innerHTML = PHASES.map((p) => {
    const tasks = allTasks.filter((t) => t.phase === p.id);
    const done = tasks.filter((t) => t.done).length;
    return `
      <div class="stat-card">
        <div class="stat-num ${p.id}">${done}/${tasks.length}</div>
        <div class="stat-label">${p.label}</div>
      </div>
    `;
  }).join("");

  // Phase sections
  tasksContainer.innerHTML = "";
  for (const p of PHASES) {
    const tasks = allTasks.filter((t) => t.phase === p.id);
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
      // Re-open to edit, or unmark? For now: tap to unmark.
      if (confirm(`Unmark "${t.title}" as done? This will remove its earnings.`)) {
        updateDoc(doc(db, "tasks", t.id), {
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

  // Wire up listeners
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
  if (!pendingAssign) return;
  await updateDoc(doc(db, "tasks", pendingAssign.taskId), {
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

// ─── Earnings screen ─────────────────────────────────────────────
function renderEarnings() {
  const totals = {};
  PEOPLE.forEach((p) => totals[p] = { earned: 0, tasks: 0 });

  let pool = 0, paidOut = 0;
  for (const t of allTasks) {
    pool += Number(t.pay) || 0;
    if (t.done && t.assignments) {
      for (const [name, pct] of Object.entries(t.assignments)) {
        if (totals[name]) {
          const amount = (Number(t.pay) || 0) * (Number(pct) / 100);
          totals[name].earned += amount;
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

  // Sorted highest earner first
  const sorted = PEOPLE.slice().sort((a, b) => totals[b].earned - totals[a].earned);

  peopleList.innerHTML = sorted.map((name) => {
    const { earned, tasks } = totals[name];
    const initial = name[0];
    return `
      <div class="person-card">
        <div class="person-name">
          <span class="avatar" style="background: ${PERSON_COLORS[name]}">${initial}</span>
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

// ─── Bottom nav ──────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      document.querySelectorAll(".nav-btn").forEach((b) =>
        b.classList.toggle("active", b === btn));
      document.querySelectorAll(".screen").forEach((s) =>
        s.classList.toggle("hidden", s.dataset.screen !== target));
      window.scrollTo({ top: 0 });
    });
  });
}

// ─── Sheets (overlay close) ──────────────────────────────────────
function setupSheets() {
  addSheet.addEventListener("click", (e) => {
    if (e.target === addSheet) addSheet.classList.add("hidden");
  });
}

// ─── Add task ────────────────────────────────────────────────────
function setupAddTask() {
  addBtn.addEventListener("click", () => addSheet.classList.remove("hidden"));
  addCancel.addEventListener("click", () => addSheet.classList.add("hidden"));

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title    = $("new-title").value.trim();
    const pay      = parseInt($("new-pay").value, 10) || 0;
    const phase    = $("new-phase").value;
    const boutique = $("new-boutique").value || null;

    if (!title) return;

    const maxOrder = allTasks.reduce((m, t) => Math.max(m, t.order || 0), 0);

    await addDoc(tasksRef, {
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

// ─── Seed defaults ───────────────────────────────────────────────
async function seedDefaults() {
  $("seed-btn").disabled = true;
  $("seed-btn").textContent = "Loading…";
  try {
    const batch = writeBatch(db);
    SEED_TASKS.forEach((t, i) => {
      const ref = doc(tasksRef);
      batch.set(ref, {
        ...t,
        order: i,
        done: false,
        assignments: {},
        completedAt: null,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    alert("Couldn't load defaults: " + err.message);
    $("seed-btn").disabled = false;
    $("seed-btn").textContent = "Load defaults";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
