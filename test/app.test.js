const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Starts the app in a fresh DOM. Pass storedTasks to simulate data saved by an earlier session.
function loadApp(storedTasks) {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  if (storedTasks !== undefined) {
    dom.window.localStorage.setItem("tasks", JSON.stringify(storedTasks));
  }
  dom.window.eval(appSource);
  return dom.window;
}

function visibleTexts(window) {
  return [...window.document.querySelectorAll(".task-text")].map(
    (el) => el.textContent,
  );
}

function counterText(window) {
  return window.document.getElementById("task-counter").textContent;
}

function storedTasks(window) {
  return JSON.parse(window.localStorage.getItem("tasks"));
}

function itemFor(window, text) {
  return [...window.document.querySelectorAll(".task-item")].find(
    (li) => li.querySelector(".task-text").textContent === text,
  );
}

function addTask(window, text) {
  window.document.getElementById("task-input").value = text;
  window.document.getElementById("add-form").requestSubmit();
}

test("tasks saved without a done flag load as not done", () => {
  const window = loadApp([
    { text: "Old A", createdAt: 1 },
    { text: "Old B", createdAt: 2 },
  ]);

  const checkboxes = [...window.document.querySelectorAll(".task-checkbox")];
  assert.equal(checkboxes.length, 2);
  assert.ok(checkboxes.every((cb) => !cb.checked));
  assert.equal(counterText(window), "2 tasks remaining");
});

test("stored done tasks are listed last on load", () => {
  const window = loadApp([
    { text: "Done", createdAt: 1, done: true },
    { text: "Open A", createdAt: 2 },
    { text: "Open B", createdAt: 3, done: false },
  ]);

  assert.deepEqual(visibleTexts(window), ["Open A", "Open B", "Done"]);
  assert.ok(itemFor(window, "Done").classList.contains("task-item--done"));
});

test("checking a task marks it done, moves it last and saves it", () => {
  const window = loadApp([
    { text: "A", createdAt: 1 },
    { text: "B", createdAt: 2 },
  ]);

  itemFor(window, "A").querySelector(".task-checkbox").click();

  assert.deepEqual(visibleTexts(window), ["B", "A"]);
  assert.ok(itemFor(window, "A").classList.contains("task-item--done"));
  assert.equal(storedTasks(window)[0].done, true);
  assert.equal(counterText(window), "1 task remaining");
});

test("unchecking a done task moves it back and saves it", () => {
  const window = loadApp([
    { text: "A", createdAt: 1, done: true },
    { text: "B", createdAt: 2 },
  ]);

  itemFor(window, "A").querySelector(".task-checkbox").click();

  assert.deepEqual(visibleTexts(window), ["A", "B"]);
  assert.ok(!itemFor(window, "A").classList.contains("task-item--done"));
  assert.equal(storedTasks(window)[0].done, false);
  assert.equal(counterText(window), "2 tasks remaining");
});

test("completion survives a reload", () => {
  const first = loadApp([{ text: "A", createdAt: 1 }]);
  first.document.querySelector(".task-checkbox").click();

  const reloaded = loadApp(storedTasks(first));

  assert.equal(reloaded.document.querySelector(".task-checkbox").checked, true);
  assert.equal(counterText(reloaded), "0 tasks remaining");
});

test("counter uses singular and plural and updates immediately", () => {
  const window = loadApp();
  assert.equal(counterText(window), "0 tasks remaining");

  addTask(window, "A");
  assert.equal(counterText(window), "1 task remaining");

  addTask(window, "B");
  assert.equal(counterText(window), "2 tasks remaining");

  itemFor(window, "B").querySelector(".delete-btn").click();
  assert.equal(counterText(window), "1 task remaining");
});

test("adding a task saves it as not done", () => {
  const window = loadApp();

  addTask(window, "New");

  assert.deepEqual(visibleTexts(window), ["New"]);
  assert.equal(storedTasks(window)[0].done, false);
  assert.equal(window.document.getElementById("task-input").value, "");
});

test("deleting from a reordered list removes the right task", () => {
  const window = loadApp([
    { text: "Done", createdAt: 1, done: true },
    { text: "Open", createdAt: 2 },
  ]);

  itemFor(window, "Open").querySelector(".delete-btn").click();

  assert.deepEqual(visibleTexts(window), ["Done"]);
  assert.deepEqual(
    storedTasks(window).map((task) => task.text),
    ["Done"],
  );
});

test("task text is shown as text, not parsed as HTML", () => {
  const window = loadApp([{ text: "<b>x</b>", createdAt: 1 }]);

  const span = window.document.querySelector(".task-text");
  assert.equal(span.textContent, "<b>x</b>");
  assert.equal(span.querySelector("b"), null);
});
