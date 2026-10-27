const form = document.getElementById("add-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const count = document.getElementById("task-count");

// Tasks saved before "done" existed are treated as not done
let tasks = (JSON.parse(localStorage.getItem("tasks")) || []).map((task) => ({
  ...task,
  done: task.done === true,
}));

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function renderCount() {
  const remaining = tasks.filter((task) => !task.done).length;
  count.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
}

function renderTasks() {
  list.innerHTML = "";

  // Done tasks last; data-index still points into the unsorted tasks array
  tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => Number(a.task.done) - Number(b.task.done))
    .forEach(({ task, index }) => {
      const li = document.createElement("li");
      li.className = task.done ? "task-item done" : "task-item";

      const label = document.createElement("label");
      label.className = "task-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "task-toggle";
      checkbox.checked = task.done;
      checkbox.dataset.index = index;

      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = task.text;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.index = index;
      deleteBtn.textContent = "Delete";

      label.append(checkbox, text);
      li.append(label, deleteBtn);
      list.appendChild(li);
    });

  renderCount();
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
  if (e.target.classList.contains("task-toggle")) {
    const index = parseInt(e.target.dataset.index, 10);
    tasks[index].done = e.target.checked;
    saveTasks();
    renderTasks();
    // Re-rendering drops focus; keep it on the toggled task for keyboard users
    list.querySelector(`.task-toggle[data-index="${index}"]`).focus();
  }
});

renderTasks();
