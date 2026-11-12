(() => {
  "use strict";

  const STATUSES = ["todo", "progress", "done"];
  const STATUS_LABELS = { todo: "A Fazer", progress: "Em Andamento", done: "Concluído" };
  const user = window.AsperAuth.getCurrentUser();
  if (!user) return;

  const storageKey = `asper_tasks_${user.id}`;
  const lists = new Map(STATUSES.map((status) => [status, document.querySelector(`[data-list="${status}"]`)]));
  const dialog = document.getElementById("task-dialog");
  const form = document.getElementById("task-form");
  const titleInput = document.getElementById("task-title");
  const descriptionInput = document.getElementById("task-description");
  const priorityInput = document.getElementById("task-priority");
  const dueDateInput = document.getElementById("task-due-date");
  const toastRegion = document.getElementById("toast-region");
  let draggedTaskId = null;
  let tasks = loadTasks();

  function loadTasks() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Os dados das tarefas estão inválidos.");
      return parsed.filter((task) =>
        task && typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.description === "string" &&
        STATUSES.includes(task.status)
      );
    } catch (error) {
      console.error("Falha ao carregar as tarefas do Asper.", error);
      showToast(error instanceof Error ? error.message : "Não foi possível carregar as tarefas.", true);
      return [];
    }
  }

  function persist(updatedTasks, successMessage) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedTasks));
      tasks = updatedTasks;
      render();
      if (successMessage) showToast(successMessage);
      return true;
    } catch (error) {
      console.error("Falha ao salvar as tarefas do Asper.", error);
      showToast("Não foi possível salvar. Verifique o espaço disponível no navegador.", true);
      return false;
    }
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function createMoveControl(task) {
    const label = document.createElement("label");
    label.className = "move-control";
    label.append(document.createTextNode("Mover para"));
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Mover "${task.title}" para`);
    STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = STATUS_LABELS[status];
      option.selected = status === task.status;
      select.append(option);
    });
    select.addEventListener("change", () => moveTask(task.id, select.value));
    label.append(select);
    return label;
  }

  function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.taskId = task.id;

    // Título transformado em link clicável para abrir a página da tarefa
    const title = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = `task.html?id=${encodeURIComponent(task.id)}`;
    titleLink.textContent = task.title;
    titleLink.className = "text-link";
    title.append(titleLink);
    card.append(title);

    if (task.description) {
      const description = document.createElement("p");
      description.textContent = task.description;
      card.append(description);
    }

    const metadata = document.createElement("p");
    metadata.className = "task-metadata";
    const priorityValue = ["low", "normal", "high"].includes(task.priority) ? task.priority : "normal";
    const priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta" };
    const priority = document.createElement("span");
    priority.className = `priority-badge priority-${priorityValue}`;
    priority.textContent = `Prioridade ${priorityLabels[priorityValue].toLocaleLowerCase("pt-BR")}`;
    metadata.append(priority);
    if (typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      const dueDate = document.createElement("span");
      const parsedDate = new Date(`${task.dueDate}T00:00:00Z`);
      if (!Number.isNaN(parsedDate.getTime())) {
        dueDate.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(parsedDate);
        metadata.append(dueDate);
      }
    }
    card.append(metadata);

    const footer = document.createElement("div");
    footer.className = "task-card-footer";
    footer.append(createMoveControl(task));
    const removeButton = document.createElement("button");
    removeButton.className = "delete-task";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Excluir tarefa: ${task.title}`);
    removeButton.addEventListener("click", () => {
      if (!window.confirm(`Excluir a tarefa “${task.title}”?`)) return;
      const updatedTasks = tasks.filter((item) => item.id !== task.id);
      persist(updatedTasks, "Tarefa excluída.");
    });
    footer.append(removeButton);
    card.append(footer);

    card.addEventListener("dragstart", (event) => {
      draggedTaskId = task.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    });
    card.addEventListener("dragend", () => {
      draggedTaskId = null;
      card.classList.remove("is-dragging");
      document.querySelectorAll(".board-column.is-drag-over").forEach((column) => column.classList.remove("is-drag-over"));
    });
    return card;
  }

  function render() {
    STATUSES.forEach((status) => {
      const list = lists.get(status);
      const statusTasks = tasks.filter((task) => task.status === status);
      list.replaceChildren();
      const count = document.querySelector(`[data-count="${status}"]`);
      count.textContent = String(statusTasks.length);
      count.setAttribute("aria-label", `${statusTasks.length} ${statusTasks.length === 1 ? "tarefa" : "tarefas"}`);
      if (statusTasks.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const icon = document.createElement("span");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "○";
        empty.append(icon, document.createTextNode("Nada por aqui ainda."));
        list.append(empty);
        return;
      }
      statusTasks.forEach((task) => list.append(createTaskCard(task)));
    });
  }

  function moveTask(id, destination) {
    if (!STATUSES.includes(destination)) return;
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === destination) return;
    const updatedTasks = tasks.map((item) => item.id === id ? { ...item, status: destination } : item);
    persist(updatedTasks, `Tarefa movida para ${STATUS_LABELS[destination]}.`);
  }

  document.querySelectorAll(".board-column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("is-drag-over");
    });
    column.addEventListener("dragleave", (event) => {
      if (!column.contains(event.relatedTarget)) column.classList.remove("is-drag-over");
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("is-drag-over");
      const id = event.dataTransfer.getData("text/plain") || draggedTaskId;
      if (id) moveTask(id, column.dataset.status);
    });
  });

  document.getElementById("add-task-button").addEventListener("click", () => {
    form.reset();
    document.getElementById("task-title-error").textContent = "";
    titleInput.removeAttribute("aria-invalid");
    dialog.showModal();
    titleInput.focus();
  });
  document.getElementById("close-task-dialog").addEventListener("click", () => dialog.close());
  document.getElementById("cancel-task").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  titleInput.addEventListener("input", () => {
    titleInput.removeAttribute("aria-invalid");
    document.getElementById("task-title-error").textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.setAttribute("aria-invalid", "true");
      document.getElementById("task-title-error").textContent = "Informe um título para a tarefa.";
      titleInput.focus();
      return;
    }
    const task = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description: descriptionInput.value.trim(),
      priority: priorityInput.value,
      dueDate: dueDateInput.value,
      assignee: user.name || user.username,
      status: "todo"
    };
    if (persist([...tasks, task], "Tarefa adicionada com sucesso.")) dialog.close();
  });

  render();
})();