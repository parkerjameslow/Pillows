// Default Pillow Show task list — used by the "Load defaults" button on first run.
// Tasks are pulled from the paper "Pillow Show Breakdown" sheet.
// boutique: "ST" = Simple Treasures, "HC" = Holy Cow, null = applies to both / N/A.

export const SEED_TASKS = [
  // ── Pre ──
  { phase: "pre", title: "Design / Order",                 pay: 300, boutique: null },
  { phase: "pre", title: "Stuff Pillows / Organize — Show 1", pay: 100, boutique: null },
  { phase: "pre", title: "Stuff Pillows / Organize — Show 2", pay: 100, boutique: null },
  { phase: "pre", title: "Organize Pillows in Office",     pay: 100, boutique: null },
  { phase: "pre", title: "Count, Sticker, Pack — Show 1",  pay: 200, boutique: null },
  { phase: "pre", title: "Count, Sticker, Pack — Show 2",  pay: 200, boutique: null },
  { phase: "pre", title: "Organize Car & Garage for Show", pay: 150, boutique: null },

  // ── Setup ──
  { phase: "setup", title: "Set Up — Holy Cow",            pay: 300, boutique: "HC" },
  { phase: "setup", title: "Set Up — Simple Treasures",    pay: 320, boutique: "ST" },
  { phase: "setup", title: "Car Restock Bins — 1st Time",  pay: 100, boutique: null },
  { phase: "setup", title: "Restock Bins Wednesday",       pay: 20,  boutique: null },
  { phase: "setup", title: "Restock Bins Thursday",        pay: 20,  boutique: null },
  { phase: "setup", title: "Restock Bins Friday",          pay: 20,  boutique: null },

  // ── During (Show Booth Refresh) ──
  { phase: "during", title: "Tuesday Night Refresh",  pay: 50, boutique: "ST" },
  { phase: "during", title: "Wed Morning Refresh",    pay: 30, boutique: "HC" },
  { phase: "during", title: "Wed Night Refresh",      pay: 50, boutique: "ST" },
  { phase: "during", title: "Thurs Morning Refresh",  pay: 30, boutique: "HC" },
  { phase: "during", title: "Thurs Night Refresh",    pay: 50, boutique: "ST" },
  { phase: "during", title: "Fri Morning Refresh",    pay: 30, boutique: "HC" },
  { phase: "during", title: "Fri Night Refresh",      pay: 50, boutique: "ST" },
  { phase: "during", title: "Sat Morning Refresh",    pay: 30, boutique: "HC" },

  // ── Take Down ──
  { phase: "takedown", title: "Show Take Down — Simple Treasures", pay: 220, boutique: "ST" },
  { phase: "takedown", title: "Show Take Down — Holy Cow",         pay: 200, boutique: "HC" },
  { phase: "takedown", title: "After Show Organization",           pay: 300, boutique: null },
  { phase: "takedown", title: "Photo Shoot Organization",          pay: 40,  boutique: null },
];
