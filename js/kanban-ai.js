(() => {
  "use strict";

  const DB_KEY = "asper_collab_db_v1";
  const ACTIVE_BOARD_KEY = "asper_active_board";
  const STATUS_LABELS = {
    todo: "A Fazer",
    progress: "Em Andamento",
    done: "Concluído"
  };
  const PRIORITY_LABELS = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta"
  };
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

  function formatTask(task) {
    const details = [STATUS_LABELS[task.status] || "status não informado"];
    if (task.priority) details.push(`prioridade ${PRIORITY_LABELS[task.priority] || task.priority}`);
    if (task.assignee) details.push(`responsável ${task.assignee}`);
    if (task.dueDate) details.push(`prazo ${task.dueDate}`);
    return `• ${taskTitle(task)} — ${details.join("; ")}`;
  }

  function listTasks(tasks, heading, emptyMessage) {
    if (tasks.length === 0) return emptyMessage;
    return `${heading} (${tasks.length}):\n${tasks.map(formatTask).join("\n")}`;
  }

  function getStatusFilter(question) {
    if (/\b(todo|a fazer|backlog|pendentes?|nao iniciadas?)\b/.test(question)) {
      return (task) => task.status === "todo";
    }
    if (/\b(progress|em andamento|em progresso|fazendo)\b/.test(question)) {
      return (task) => task.status === "progress";
    }
    if (/\b(done|concluidas?|finalizadas?|entregues?)\b/.test(question)) {
      return (task) => task.status === "done";
    }
    return null;
  }

  function getPriorityFilter(question) {
    if (/\b(urgente|prioridade alta|alta prioridade)\b/.test(question)) {
      return (task) => task.priority === "alta" || task.label === "urgente";
    }
    if (/\b(prioridade media|media prioridade)\b/.test(question)) {
      return (task) => task.priority === "media";
    }
    if (/\b(prioridade baixa|baixa prioridade)\b/.test(question)) {
      return (task) => task.priority === "baixa";
    }
    return null;
  }

  function getSearchTerm(question) {
    const patterns = [
      /\b(?:buscar|busca|busque|procura|procure|procurar|pesquisa|pesquise|pesquisar|encontra|encontre|encontrar|localiza|localize|localizar)\s+(?:por\s+)?(.+)$/,
      /\b(?:tarefas?|cards?)\s+(?:sobre|relacionadas?\s+a|com\s+(?:o\s+)?titulo|chamadas?\s+por)\s+(.+)$/,
      /\b(?:prazo|vencimento)\s+(?:da|do|de)\s+(?:tarefa|card)\s+(.+)$/,
      /\b(?:status|detalhes|responsavel|prioridade)\s+(?:da|do|de)\s+(?:tarefa|card)\s+(.+)$/,
      /\bresponsavel\s+(?:pela|pelo)\s+(?:tarefa|card)\s+(.+)$/,
      /\b(?:tem|existe|ha)\s+(?:(?:algum|alguma)\s+)?(?:tarefa|card)\s+(?:sobre|de|com|chamada?)\s+(.+)$/,
      /\b(?:sobre|titulo|chamada?)\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) {
        return match[1].replace(/^[\s"'“”]+|[\s"'“”?!.,]+$/g, "").trim();
      }
    }
    return "";
  }

  function getSearchAnswer(tasks, term) {
    if (!term) {
      return "Diga também o nome ou palavra que devo procurar, por exemplo: “Busque login”.";
    }

    const matches = tasks.filter((task) => {
      const searchable = normalize([
        task.title || "",
        task.description || "",
        task.assignee || ""
      ].join(" "));
      return searchable.includes(term);
    });
    return listTasks(
      matches,
      `Tarefas encontradas para “${term}”`,
      `Não encontrei tarefas com “${term}” no quadro ativo.`
    );
  }

  function getDeadlineFilter(question) {
    if (!/\b(prazo|prazos|vence|vencem|vencimento|atrasadas?|atraso)\b/.test(question)) {
      return null;
    }

    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    if (/\b(sem prazo|sem data)\b/.test(question)) {
      return { description: "sem prazo", filter: (task) => !task.dueDate };
    }
    if (/\b(atrasadas?|atraso|vencidas?)\b/.test(question)) {
      return {
        description: "atrasadas",
        filter: (task) => task.dueDate && task.dueDate < todayKey && task.status !== "done"
      };
    }
    if (/\bhoje\b/.test(question)) {
      return {
        description: "com prazo hoje",
        filter: (task) => task.dueDate === todayKey && task.status !== "done"
      };
    }
    if (/\b(proxim[oa]s?|em breve)\b/.test(question)) {
      return {
        description: "com próximos prazos",
        filter: (task) => task.dueDate && task.dueDate >= todayKey && task.status !== "done"
      };
    }
    return {
      description: "com prazo",
      filter: (task) => task.dueDate && task.status !== "done"
    };
  }

  function getCreationAccessError(board) {
    const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;
    if (!user) return "Não consegui confirmar sua sessão. Entre novamente para criar cards.";

    const userEmail = (user.email || user.id || "").toLowerCase();
    const isOwner = board.dono_id === userEmail;
    const member = Array.isArray(board.members)
      ? board.members.find((item) => item.email === userEmail)
      : null;
    return !isOwner && (!member || member.papel !== "EDITOR")
      ? "Seu acesso a este quadro não permite criar tarefas."
      : "";
  }

  function createTasks(board, db, count, theme) {
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
      title: count === 1 ? safeTheme.slice(0, 120) : `${safeTheme} — ${steps[index]}`.slice(0, 120),
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
    return {
      tasks: createdTasks,
      theme: safeTheme,
      boardName: board.nome
    };
  }

  function makeTaskId(index) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `ai-task-${window.crypto.randomUUID()}`;
    }
    return `ai-task-${Date.now()}-${index}`;
  }

  // Batch creation is an explicit local command, separate from data-based answers.
  function createTasksFromCommand(message) {
    const match = message.match(/^\s*(?:crie|cria|criar|adicione|adiciona|adicionar|gere|gera|gerar)\s+(\d{1,2})\s+(?:cards?|tarefas?)\s+(?:para|sobre|de)\s+(.+?)\s*$/i);
    if (!match) return null;

    const count = Number(match[1]);
    const theme = match[2].replace(/^\[(.*)\]$/, "$1").trim();
    if (!theme) return "Informe um tema após “Crie N cards para”.";
    if (count < 1 || count > 10) return "Posso criar de 1 a 10 cards por comando.";

    const { db, board } = readActiveBoardData();
    const accessError = getCreationAccessError(board);
    if (accessError) return accessError;

    const result = createTasks(board, db, count, theme);
    return `Criei ${result.tasks.length} cards de rascunho sobre “${result.theme}” no quadro “${result.boardName}”.`;
  }

  function createSingleTaskFromCommand(message) {
    const match = message.match(/^\s*(?:(?:por favor|preciso)\s+)?(?:crie|cria|criar|adicione|adiciona|adicionar|gere|gera|gerar)\s+(?:(?:uma?|um)\s+)?(?:(?:nova|novo)\s+)?(?:tarefa|card)\b(?:(?:\s+(?:chamad[oa]|com\s+(?:o\s+)?t[ií]tulo|para|de))|\s*[:\-—]\s*)?\s*(.+?)\s*$/i);
    if (!match) return null;

    const title = match[1].replace(/^[\s"'“”]+|[\s"'“”?!.,]+$/g, "").trim();
    if (!title) return "Informe o título da tarefa que deseja criar.";

    const { db, board } = readActiveBoardData();
    const accessError = getCreationAccessError(board);
    if (accessError) return accessError;

    const result = createTasks(board, db, 1, title);
    return `Criei a tarefa “${result.tasks[0].title}” no quadro “${result.boardName}”.`;
  }

  function isIncompleteTaskCommand(message) {
    return /^\s*(?:(?:por favor|preciso)\s+)?(?:crie|cria|criar|adicione|adiciona|adicionar|gere|gera|gerar)\s+(?:(?:uma?|um)\s+)?(?:(?:nova|novo)\s+)?(?:tarefa|card)\s*$/i.test(message);
  }

  function answerTaskQuery(question, tasks) {
    const searchTerm = getSearchTerm(question);
    if (searchTerm && /\b(prazo|vencimento)\b/.test(question)) {
      return getSearchAnswer(tasks, searchTerm);
    }

    const statusFilter = getStatusFilter(question);
    const priorityFilter = getPriorityFilter(question);
    const deadlineFilter = getDeadlineFilter(question);
    const filters = [statusFilter, priorityFilter, deadlineFilter && deadlineFilter.filter].filter(Boolean);

    const unassignedFilter = /\b(sem responsavel|nao atribuidas?|sem atribuicao)\b/.test(question);
    if (unassignedFilter) {
      filters.push((task) => !task.assignee);
    }

    let assigneeMatch = question.match(/\b(?:responsavel(?: por)?|atribuida a|atribuido a)\s+(.+?)[?!.]*$/);
    if (!assigneeMatch) {
      assigneeMatch = question.match(/\b(?:com|tarefas? (?:de|do|da)|cards? (?:de|do|da))\s+(.+?)[?!.]*$/);
      if (assigneeMatch && /^(?:quadro|projeto|prazo|prioridade|alta|media|baixa|hoje|amanha|atrasadas?|em andamento|em progresso|concluidas?|finalizadas?)\b/.test(assigneeMatch[1])) {
        assigneeMatch = null;
      }
    }
    if (assigneeMatch) {
      const assignee = assigneeMatch[1].trim();
      filters.push((task) => normalize(task.assignee || "").includes(assignee));
    }

    if (filters.length > 0) {
      const matches = tasks.filter((task) => filters.every((filter) => filter(task)));
      const assigneeName = assigneeMatch
        ? matches.find((task) => normalize(task.assignee || "").includes(assigneeMatch[1].trim()))?.assignee || assigneeMatch[1].trim()
        : "";
      const statusDescription = statusFilter
        ? `com status ${/\b(todo|a fazer|backlog|pendentes?|nao iniciadas?)\b/.test(question)
          ? STATUS_LABELS.todo
          : /\b(progress|em andamento|em progresso|fazendo)\b/.test(question)
            ? STATUS_LABELS.progress
            : STATUS_LABELS.done}`
        : "";
      const priorityDescription = priorityFilter
        ? `com prioridade ${/\b(urgente|prioridade alta|alta prioridade)\b/.test(question)
          ? "alta ou label urgente"
          : /\b(prioridade media|media prioridade)\b/.test(question)
            ? PRIORITY_LABELS.media
            : PRIORITY_LABELS.baixa}`
        : "";
      const criteria = [
        statusDescription,
        priorityDescription,
        deadlineFilter && deadlineFilter.description,
        unassignedFilter && "sem responsável",
        assigneeMatch && `atribuídas a ${assigneeName}`
      ].filter(Boolean).join(" e ");
      return listTasks(matches, `Tarefas ${criteria}`, `Não encontrei tarefas ${criteria} neste quadro.`);
    }

    if (/\b(minhas?|meus?)\s+(tarefas?|cards?)\b/.test(question)) {
      const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;
      const identity = normalize(user && (user.email || user.username || user.name) || "");
      const mine = tasks.filter((task) => normalize(task.assignee || "") === identity);
      return listTasks(mine, "Suas tarefas", "Não encontrei tarefas atribuídas a você neste quadro.");
    }

    if (searchTerm) return getSearchAnswer(tasks, searchTerm);

    return null;
  }

  function answerQuestion(message) {
    const generated = createTasksFromCommand(message);
    if (generated !== null) return generated;

    if (isIncompleteTaskCommand(message)) {
      return "Qual título devo usar para a nova tarefa?";
    }

    const singleTask = createSingleTaskFromCommand(message);
    if (singleTask !== null) return singleTask;

    const { tasks } = readActiveBoardData();
    const question = normalize(message);

    if (/\b(travad[oa]s?|impedimentos?|bloquead[oa]s?)\b/.test(question)) {
      return getBlockedAnswer(tasks);
    }
    if (/\b(falta|faltam|pendencias?|lancar|lancamento)\b/.test(question)) {
      return getPendingAnswer(tasks);
    }
    if ((/\bquem\b/.test(question) && /\b(mais|maior)\b/.test(question))
      || /\b(carga|distribuicao)\b/.test(question)) {
      return getWorkloadAnswer(tasks);
    }

    const taskAnswer = answerTaskQuery(question, tasks);
    if (taskAnswer !== null) return taskAnswer;

    if (/\b(progresso|resumo|como esta o (?:projeto|quadro)|andamento (?:do projeto|do quadro)|status geral)\b/.test(question)) {
      return getProgressAnswer(tasks);
    }

    return "Ainda não entendi esse pedido. Posso listar tarefas por status, prioridade, responsável, prazo ou palavra-chave; ver progresso, pendências e carga da equipe; criar uma tarefa com “Crie uma tarefa chamada Revisar login”; ou criar várias com “Crie 5 cards para app-delivery”. Não altero nem excluo cards por chat.";
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
