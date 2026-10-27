const form = document.getElementById("add-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const counter = document.getElementById("task-counter");

// Tasks saved before completion existed have no "done" field; treat them as not done
let tasks = (JSON.parse(localStorage.getItem("tasks")) || []).map((task) => ({
  ...task,
  done: Boolean(task.done),
}));

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function renderCounter() {
  const remaining = tasks.filter((task) => !task.done).length;
  counter.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;
}

function renderTasks() {
  list.innerHTML = "";

  // Sort a copy so data-index still points into the stored array
  const ordered = tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => Number(a.task.done) - Number(b.task.done));

  ordered.forEach(({ task, index }) => {
    const li = document.createElement("li");
    li.className = task.done ? "task-item task-item--done" : "task-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.done;
    checkbox.dataset.index = index;
    checkbox.setAttribute("aria-label", `Mark "${task.text}" as done`);

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.dataset.index = index;
    deleteBtn.textContent = "Delete";

    li.append(checkbox, text, deleteBtn);
    list.appendChild(li);
  });

  renderCounter();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    tasks.push({ text, createdAt: Date.now(), done: false });
    saveTasks();
    renderTasks();
    input.value = "";
  }
});

list.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-btn")) {
    const index = parseInt(e.target.dataset.index, 10);
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }
});

list.addEventListener("change", (e) => {
  if (e.target.classList.contains("task-checkbox")) {
    const index = parseInt(e.target.dataset.index, 10);
    tasks[index].done = e.target.checked;
    saveTasks();
    renderTasks();
  }
});

renderTasks();
