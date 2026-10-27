const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Loads index.html in jsdom, seeds localStorage like an earlier visit would,
// then runs app.js the way the browser does on page load.
function loadApp(storedTasks) {
  const { window } = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  if (storedTasks !== undefined) {
    window.localStorage.setItem("tasks", JSON.stringify(storedTasks));
  }
  window.eval(appSource);

  const { document } = window;
  const findItem = (text) =>
    [...document.querySelectorAll(".task-item")].find(
      (li) => li.querySelector(".task-text").textContent === text,
    );

  return {
    window,
    document,
    rows: () =>
      [...document.querySelectorAll(".task-item")].map((li) => ({
        text: li.querySelector(".task-text").textContent,
        done: li.classList.contains("done"),
        checked: li.querySelector(".task-toggle").checked,
      })),
    count: () => document.getElementById("task-count").textContent,
    stored: () => JSON.parse(window.localStorage.getItem("tasks")),
    checkbox: (text) => findItem(text).querySelector(".task-toggle"),
    toggle: (text) => findItem(text).querySelector(".task-toggle").click(),
    remove: (text) => findItem(text).querySelector(".delete-btn").click(),
    add: (text) => {
      document.getElementById("task-input").value = text;
      document.getElementById("add-form").requestSubmit();
    },
  };
}

// Simulates a page reload: a fresh page with the same localStorage contents
function reload(app) {
  return loadApp(app.stored());
}

const legacyTasks = [
  { text: "A", createdAt: 1 },
  { text: "B", createdAt: 2 },
  { text: "C", createdAt: 3 },
];

// Saved tasks from before "done" existed

test("legacy tasks without done are shown as not done", () => {
  const app = loadApp(legacyTasks);
  assert.deepEqual(app.rows(), [
    { text: "A", done: false, checked: false },
    { text: "B", done: false, checked: false },
    { text: "C", done: false, checked: false },
  ]);
  assert.equal(app.count(), "3 tasks left");
});

test("legacy tasks are saved with done: false on the next save", () => {
  const app = loadApp(legacyTasks);
  app.add("D");
  assert.deepEqual(
    app.stored().map((t) => [t.text, t.done]),
    [
      ["A", false],
      ["B", false],
      ["C", false],
      ["D", false],
    ],
  );
});

test("stored done tasks are checked and shown last", () => {
  const app = loadApp([
    { text: "A", createdAt: 1, done: true },
    { text: "B", createdAt: 2 },
    { text: "C", createdAt: 3, done: false },
  ]);
  assert.deepEqual(app.rows(), [
    { text: "B", done: false, checked: false },
    { text: "C", done: false, checked: false },
    { text: "A", done: true, checked: true },
  ]);
  assert.equal(app.count(), "2 tasks left");
});

test("empty storage shows an empty list", () => {
  const app = loadApp();
  assert.deepEqual(app.rows(), []);
  assert.equal(app.count(), "0 tasks left");
});

// Marking tasks as done

test("checking a task marks it done, moves it last and saves it", () => {
  const app = loadApp(legacyTasks);
  app.toggle("A");
  assert.deepEqual(
    app.rows().map((r) => [r.text, r.done]),
    [
      ["B", false],
      ["C", false],
      ["A", true],
    ],
  );
  assert.equal(app.stored()[0].done, true);
  assert.equal(app.count(), "2 tasks left");
});

test("unchecking a task restores it to its original place", () => {
  const app = loadApp(legacyTasks);
  app.toggle("A");
  app.toggle("A");
  assert.deepEqual(app.rows(), [
    { text: "A", done: false, checked: false },
    { text: "B", done: false, checked: false },
    { text: "C", done: false, checked: false },
  ]);
  assert.equal(app.stored()[0].done, false);
});

test("done state survives a reload", () => {
  const app = loadApp(legacyTasks);
  app.toggle("B");
  const reloaded = reload(app);
  assert.deepEqual(
    reloaded.rows().map((r) => [r.text, r.done]),
    [
      ["A", false],
      ["C", false],
      ["B", true],
    ],
  );
  assert.equal(reloaded.count(), "2 tasks left");
});

test("deleting from a sorted list removes the right task", () => {
  // Displayed as B, C, A while stored as A, B, C
  const app = loadApp([
    { text: "A", createdAt: 1, done: true },
    { text: "B", createdAt: 2 },
    { text: "C", createdAt: 3 },
  ]);
  app.remove("C");
  assert.deepEqual(
    app.stored().map((t) => t.text),
    ["A", "B"],
  );
  app.remove("A");
  assert.deepEqual(
    app.stored().map((t) => t.text),
    ["B"],
  );
  assert.deepEqual(
    app.rows().map((r) => r.text),
    ["B"],
  );
});

test("new tasks are not done and appear before done tasks", () => {
  const app = loadApp([{ text: "A", createdAt: 1, done: true }]);
  app.add("B");
  assert.deepEqual(
    app.rows().map((r) => [r.text, r.done]),
    [
      ["B", false],
      ["A", true],
    ],
  );
  assert.equal(app.stored()[1].done, false);
});

test("focus stays on the toggled checkbox after re-render", () => {
  const app = loadApp(legacyTasks);
  app.toggle("A");
  assert.equal(app.document.activeElement, app.checkbox("A"));
});

// Remaining-tasks counter

test("counter updates on add, toggle and delete", () => {
  const app = loadApp();
  app.add("A");
  assert.equal(app.count(), "1 task left");
  app.add("B");
  assert.equal(app.count(), "2 tasks left");
  app.toggle("A");
  assert.equal(app.count(), "1 task left");
  app.toggle("B");
  assert.equal(app.count(), "0 tasks left");
  app.remove("B");
  assert.equal(app.count(), "0 tasks left");
  app.toggle("A");
  assert.equal(app.count(), "1 task left");
});

test("task text that looks like HTML is shown as text", () => {
  const app = loadApp([{ text: "<img src=x><b>hi</b>", createdAt: 1 }]);
  assert.equal(app.rows()[0].text, "<img src=x><b>hi</b>");
  assert.equal(
    app.document.querySelectorAll("#task-list img, #task-list b").length,
    0,
  );
});
