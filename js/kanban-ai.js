(() => {
  "use strict";

  const DB_KEY = "asper_collab_db_v1";
  const ACTIVE_BOARD_KEY = "asper_active_board";
  const toggleButton = document.getElementById("toggle-ai-chat");
  const drawer = document.getElementById("ai-chat-drawer");
  const closeButton = document.getElementById("close-ai-chat");
  const messages = document.getElementById("ai-chat-messages");
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");

  if (!toggleButton || !drawer || !closeButton || !messages || !form || !input) {
    console.error("A interface do Jasper não está completa.");
    return;
  }

  // Remove acentos para reconhecer perguntas em português sem depender da capitalização.
  function normalize(value) {
    return value
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Re-read storage on every turn and exclude tasks from all other boards.
  function readActiveBoardData() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) throw new Error("Os dados do quadro não foram encontrados neste navegador.");

    const db = JSON.parse(raw);
    if (!db || !Array.isArray(db.boards) || !Array.isArray(db.tasks)) {
      throw new Error("Os dados salvos do Asper estão em um formato inválido.");
    }

    const boardId = localStorage.getItem(ACTIVE_BOARD_KEY);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board) throw new Error("Não foi possível encontrar o quadro ativo.");

    return {
      db,
      board,
      tasks: db.tasks.filter((task) => task && task.board_id === boardId)
    };
  }

  function appendMessage(text, sender) {
    const message = document.createElement("div");
    message.className = `ai-chat-message ai-chat-message-${sender}`;
    message.textContent = text;
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function taskTitle(task) {
    return typeof task.title === "string" && task.title.trim()
      ? task.title.trim()
      : "Tarefa sem título";
  }

  function getProgressAnswer(tasks) {
    if (tasks.length === 0) {
      return "Este quadro ainda não tem tarefas; não há dados de progresso para resumir.";
    }

    const completed = tasks.filter((task) => task.status === "done").length;
    const percent = Math.round((completed / tasks.length) * 100);
    return `Progresso: ${completed} de ${tasks.length} tarefas concluídas (${percent}%).`;
  }

  function getBlockedAnswer(tasks) {
    const blocked = tasks.filter((task) => task.priority === "alta" && task.status !== "done");
    if (blocked.length === 0) {
      return "Não encontrei tarefas de prioridade alta ainda abertas neste quadro.";
    }

    const lines = blocked.map((task) => `• ${taskTitle(task)} (${task.status || "status não informado"})`);
    return `Tarefas de prioridade alta ainda não concluídas (${blocked.length}):\n${lines.join("\n")}`;
  }

  function getPendingAnswer(tasks) {
    const pending = tasks.filter((task) => task.status === "todo" || task.status === "progress");
    if (pending.length === 0) {
      return tasks.length === 0
        ? "Este quadro ainda não tem tarefas para listar."
        : "Não há tarefas pendentes: todas as tarefas do quadro estão concluídas.";
    }

    const lines = pending.map((task) => {
      const status = task.status === "todo" ? "A Fazer" : "Em Andamento";
      return `• ${taskTitle(task)} — ${status}`;
    });
    return `Há ${pending.length} tarefa(s) pendente(s):\n${lines.join("\n")}`;
  }

  function getWorkloadAnswer(tasks) {
    if (tasks.length === 0) {
      return "Este quadro ainda não tem tarefas para comparar a carga de trabalho.";
    }

    const workload = new Map();
    tasks.forEach((task) => {
      const assignee = typeof task.assignee === "string" && task.assignee.trim()
        ? task.assignee.trim()
        : "Sem responsável";
      workload.set(assignee, (workload.get(assignee) || 0) + 1);
    });

    const highestCount = Math.max(...workload.values());
    const leaders = Array.from(workload.entries())
      .filter(([, count]) => count === highestCount)
      .map(([name]) => name);
    const counts = Array.from(workload.entries())
      .map(([name, count]) => `${name}: ${count}`)
      .join("; ");

    if (leaders.length === 1) {
      return `${leaders[0]} tem mais tarefas (${highestCount}). Carga por responsável: ${counts}.`;
    }
    return `Empate na maior carga (${highestCount} tarefas): ${leaders.join(", ")}. Carga por responsável: ${counts}.`;
  }

  function makeTaskId(index) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `ai-task-${window.crypto.randomUUID()}`;
    }
    return `ai-task-${Date.now()}-${index}`;
  }

  // Batch creation is an explicit local command, separate from data-based answers.
  function createTasksFromCommand(message) {
    const match = message.match(/^\s*crie\s+(\d{1,2})\s+cards?\s+para\s+(.+?)\s*$/i);
    if (!match) return null;

    const count = Number(match[1]);
    const theme = match[2].replace(/^\[(.*)\]$/, "$1").trim();
    if (!theme) return "Informe um tema após “Crie N cards para”.";
    if (count < 1 || count > 10) return "Posso criar de 1 a 10 cards por comando.";

    const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;
    if (!user) return "Não consegui confirmar sua sessão. Entre novamente para criar cards.";

    const { db, board } = readActiveBoardData();
    const userEmail = (user.email || user.id || "").toLowerCase();
    const isOwner = board.dono_id === userEmail;
    const member = Array.isArray(board.members)
      ? board.members.find((item) => item.email === userEmail)
      : null;
    if (!isOwner && (!member || member.papel === "VIEWER")) {
      return "Seu acesso a este quadro não permite criar tarefas.";
    }

    const steps = [
      "Planejar",
      "Definir escopo",
      "Implementar",
      "Revisar",
      "Validar",
      "Documentar",
      "Preparar entrega",
      "Acompanhar",
      "Ajustar",
      "Finalizar"
    ];
    const safeTheme = theme.slice(0, 80).trim();
    const createdTasks = Array.from({ length: count }, (_, index) => ({
      id: makeTaskId(index),
      board_id: board.id,
      title: `${safeTheme} — ${steps[index]}`.slice(0, 120),
      description: `Card criado pelo Jasper para o tema: ${safeTheme}.`,
      status: "todo",
      priority: "media",
      label: "feature",
      dueDate: "",
      points: 1,
      assignee: "",
      checklist: [],
      comments: [],
      acceptanceCriteria: ""
    }));

    db.tasks.push(...createdTasks);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent("asper:tasks-updated"));
    return `Criei ${createdTasks.length} cards de rascunho sobre “${safeTheme}” no quadro “${board.nome}”.`;
  }

  function answerQuestion(message) {
    const generated = createTasksFromCommand(message);
    if (generated !== null) return generated;

    const { tasks } = readActiveBoardData();
    const question = normalize(message);

    if (/\b(travad[oa]s?|impedimentos?|bloquead[oa]s?)\b/.test(question)) {
      return getBlockedAnswer(tasks);
    }
    if (/\b(falta|faltam|pendencias?|lancar|lancamento|release)\b/.test(question)) {
      return getPendingAnswer(tasks);
    }
    if (/\b(quem|responsavel|carga)\b/.test(question) && /\b(mais|maior|tarefas?)\b/.test(question)) {
      return getWorkloadAnswer(tasks);
    }
    return getProgressAnswer(tasks);
  }

  function setDrawerOpen(isOpen) {
    drawer.hidden = !isOpen;
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) input.focus();
    else toggleButton.focus();
  }

  toggleButton.addEventListener("click", () => setDrawerOpen(drawer.hidden));
  closeButton.addEventListener("click", () => setDrawerOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) setDrawerOpen(false);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    appendMessage(question, "user");
    input.value = "";

    try {
      appendMessage(answerQuestion(question), "assistant");
    } catch (error) {
      console.error("Não foi possível processar a pergunta ao Jasper.", error);
      appendMessage(
        error instanceof Error ? error.message : "Não foi possível ler os dados do quadro.",
        "assistant"
      );
    }
  });
})();
