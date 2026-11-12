(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("id");

  const titleEl = document.getElementById("task-title-display");
  const descEl = document.getElementById("task-desc-display");
  const statusEl = document.getElementById("task-status-display");

  if (!taskId) {
    titleEl.textContent = "ID da tarefa não especificado.";
    return;
  }

  const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;
  if (!user) {
    window.location.assign("login.html");
    return;
  }

  const storageKey = `asper_tasks_${user.id}`;
  const rawTasks = localStorage.getItem(storageKey);

  if (!rawTasks) {
    titleEl.textContent = "Nenhuma tarefa encontrada.";
    return;
  }

  try {
    const tasks = JSON.parse(rawTasks);
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      titleEl.textContent = "Tarefa não encontrada.";
      descEl.textContent = "Verifique se o link está correto.";
      return;
    }

    titleEl.textContent = task.title;
    descEl.textContent = task.description || "Nenhuma descrição informada.";
    
    const statusNames = { todo: "A Fazer", progress: "Em Andamento", done: "Concluído" };
    statusEl.textContent = statusNames[task.status] || task.status;

  } catch (error) {
    console.error("Erro ao carregar detalhes da tarefa:", error);
    titleEl.textContent = "Erro ao carregar a tarefa.";
  }
})();
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const user = window.AsperAuth.getCurrentUser();
    if (!user) return;

    const title = document.getElementById("task-page-title");
    const description = document.getElementById("task-page-desc");
    const errorMessage = document.getElementById("task-page-error");
    const taskId = new URLSearchParams(window.location.search).get("id");
    if (!taskId) {
      title.textContent = "Tarefa não encontrada";
      errorMessage.textContent = "O link não contém uma tarefa válida.";
      return;
    }

    let tasks;
    try {
      const saved = localStorage.getItem(`asper_tasks_${user.id}`);
      tasks = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(tasks)) throw new Error("Os dados das tarefas estão inválidos.");
    } catch (error) {
      console.error("Falha ao carregar os detalhes da tarefa.", error);
      title.textContent = "Não foi possível carregar a tarefa";
      errorMessage.textContent = "Os dados salvos estão indisponíveis ou inválidos.";
      return;
    }

    const task = tasks.find((item) => item && item.id === taskId);
    if (!task) {
      title.textContent = "Tarefa não encontrada";
      errorMessage.textContent = "A tarefa pode ter sido excluída ou pertencer a outra conta.";
      return;
    }

    const statuses = { todo: "A Fazer", progress: "Em Andamento", done: "Concluído" };
    const priorities = { low: "Baixa", normal: "Normal", high: "Alta" };
    title.textContent = typeof task.title === "string" ? task.title : "Tarefa sem título";
    description.textContent = typeof task.description === "string" && task.description
      ? task.description
      : "Nenhuma descrição foi adicionada.";
    document.getElementById("task-page-status").textContent = statuses[task.status] || "A Fazer";
    document.getElementById("task-page-priority").textContent = priorities[task.priority] || "Normal";
    document.getElementById("task-page-assignee").textContent =
      typeof task.assignee === "string" && task.assignee ? task.assignee : user.name || user.username;

    const dueDate = document.getElementById("task-page-due");
    if (typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      const parsedDate = new Date(`${task.dueDate}T00:00:00Z`);
      dueDate.textContent = Number.isNaN(parsedDate.getTime())
        ? "Não definido"
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(parsedDate);
    } else {
      dueDate.textContent = "Não definido";
    }
  });
})();