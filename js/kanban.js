(() => {
  "use strict";

  const STATUSES = ["todo", "progress", "done"];
  const STATUS_LABELS = { todo: "A Fazer", progress: "Em Andamento", done: "Concluído" };
  const ROLE_LABELS = { OWNER: "Dono", EDITOR: "Editor", VIEWER: "Leitor" };

  const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;
  if (!user) {
    window.location.assign("login.html");
    return;
  }

  const userEmail = (user.email || user.id).toLowerCase();
  document.getElementById("current-user-email").textContent = userEmail;

  const DB_KEY = "asper_collab_db_v1";
  function loadDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
    const defaultBoard = {
      id: "board-1",
      nome: "Quadro Principal",
      dono_id: userEmail,
      members: [{ email: userEmail, papel: "OWNER" }]
    };
    const initial = { boards: [defaultBoard], tasks: [] };
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  let db = loadDB();
  let currentBoardId = localStorage.getItem("asper_active_board") || db.boards[0]?.id;
  let draggedTaskId = null;

  const boardSelector = document.getElementById("board-selector");
  const addTaskBtn = document.getElementById("add-task-button");
  const shareBtn = document.getElementById("share-board-button");
  const roleBadge = document.getElementById("role-badge");
  const toastRegion = document.getElementById("toast-region");

  function showToast(msg, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " is-error" : ""}`;
    toast.textContent = msg;
    toastRegion.append(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function getUserBoards() {
    const meus = db.boards.filter((b) => b.dono_id === userEmail);
    const compartilhados = db.boards.filter(
      (b) => b.dono_id !== userEmail && b.members.some((m) => m.email === userEmail)
    );
    return { meus, compartilhados };
  }

  function getCurrentBoard() {
    const { meus, compartilhados } = getUserBoards();
    const accessible = [...meus, ...compartilhados];
    let board = accessible.find((b) => b.id === currentBoardId);
    if (!board) {
      if (accessible.length === 0) {
        board = {
          id: "board-" + Date.now(),
          nome: "Meu Quadro",
          dono_id: userEmail,
          members: [{ email: userEmail, papel: "OWNER" }]
        };
        db.boards.push(board);
        saveDB(db);
      } else {
        board = accessible[0];
      }
      currentBoardId = board.id;
      localStorage.setItem("asper_active_board", currentBoardId);
    }
    return board;
  }

  function getUserRole(board) {
    if (board.dono_id === userEmail) return "OWNER";
    const member = board.members.find((m) => m.email === userEmail);
    return member ? member.papel : "VIEWER";
  }

  function renderBoardSelector() {
    const { meus, compartilhados } = getUserBoards();
    const active = getCurrentBoard();
    boardSelector.innerHTML = "";

    const grpMeus = document.createElement("optgroup");
    grpMeus.label = "Meus quadros";
    meus.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.nome;
      opt.selected = b.id === active.id;
      grpMeus.append(opt);
    });
    boardSelector.append(grpMeus);

    if (compartilhados.length > 0) {
      const grpComp = document.createElement("optgroup");
      grpComp.label = "Compartilhados comigo";
      compartilhados.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = `${b.nome} (${b.dono_id})`;
        opt.selected = b.id === active.id;
        grpComp.append(opt);
      });
      boardSelector.append(grpComp);
    }

    const role = getUserRole(active);
    roleBadge.textContent = `Papel: ${ROLE_LABELS[role]}`;
    const canEdit = role === "OWNER" || role === "EDITOR";
    addTaskBtn.style.display = canEdit ? "inline-flex" : "none";
    shareBtn.style.display = role === "OWNER" ? "inline-flex" : "none";
  }

  function createTaskCard(task, canEdit) {
    const card = document.createElement("article");
    card.className = "task-card";
    card.draggable = canEdit;
    card.dataset.taskId = task.id;

    // Badges de Prioridade, Label e Story Points
    const badges = document.createElement("div");
    badges.style.marginBottom = "6px";
    badges.innerHTML = `
      <span class="badge badge-${task.priority || 'media'}">${(task.priority || 'média').toUpperCase()}</span>
      <span class="badge badge-${task.label || 'feature'}">${(task.label || 'feature').toUpperCase()}</span>
      <span class="badge badge-sp">${task.points || 1} SP</span>
    `;
    card.append(badges);

    // Título abre a task em NOVA ABA (rota própria / URL compartilhável)
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = `task.html?id=${task.id}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = task.title;
    link.className = "text-link";
    link.addEventListener("click", (e) => e.stopPropagation());
    title.append(link);
    card.append(title);

    if (task.description) {
      const desc = document.createElement("p");
      desc.textContent = task.description;
      card.append(desc);
    }

    // Responsável e Prazo no card
    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `
      <span>👤 ${task.assignee || "Sem responsável"}</span>
      <span>${task.dueDate ? "📅 " + task.dueDate : ""}</span>
    `;
    card.append(meta);

    if (canEdit) {
      const footer = document.createElement("div");
      footer.className = "task-card-footer";

      const select = document.createElement("select");
      STATUSES.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st;
        opt.textContent = STATUS_LABELS[st];
        opt.selected = st === task.status;
        select.append(opt);
      });
      select.addEventListener("change", () => moveTask(task.id, select.value));
      footer.append(select);

      const delBtn = document.createElement("button");
      delBtn.className = "delete-task";
      delBtn.type = "button";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", () => {
        if (!confirm(`Excluir "${task.title}"?`)) return;
        db.tasks = db.tasks.filter((t) => t.id !== task.id);
        saveDB(db);
        render();
        showToast("Tarefa excluída.");
      });
      footer.append(delBtn);
      card.append(footer);

      card.addEventListener("dragstart", (e) => {
        draggedTaskId = task.id;
        e.dataTransfer.setData("text/plain", task.id);
      });
    }

    return card;
  }

  function render() {
    db = loadDB();
    renderBoardSelector();
    const board = getCurrentBoard();
    const role = getUserRole(board);
    const canEdit = role === "OWNER" || role === "EDITOR";
    const boardTasks = db.tasks.filter((t) => t.board_id === board.id);

    STATUSES.forEach((status) => {
      const list = document.querySelector(`[data-list="${status}"]`);
      const items = boardTasks.filter((t) => t.status === status);
      document.querySelector(`[data-count="${status}"]`).textContent = items.length;
      list.replaceChildren();
      if (items.length === 0) {
        list.innerHTML = `<div class="empty-state">○ Nada por aqui.</div>`;
        return;
      }
      items.forEach((task) => list.append(createTaskCard(task, canEdit)));
    });
  }

  function moveTask(id, dest) {
    const board = getCurrentBoard();
    const role = getUserRole(board);
    if (role === "VIEWER") {
      showToast("Leitores não podem editar o quadro.", true);
      return;
    }
    const task = db.tasks.find((t) => t.id === id);
    if (!task || task.status === dest) return;
    task.status = dest;
    saveDB(db);
    render();
    showToast(`Movido para ${STATUS_LABELS[dest]}.`);
  }

  // Drag and Drop
  document.querySelectorAll(".board-column").forEach((col) => {
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || draggedTaskId;
      if (id) moveTask(id, col.dataset.status);
    });
  });

  // Trocar ou criar quadro
  boardSelector.addEventListener("change", () => {
    currentBoardId = boardSelector.value;
    localStorage.setItem("asper_active_board", currentBoardId);
    render();
  });

  document.getElementById("new-board-button").addEventListener("click", () => {
    const nome = prompt("Nome do novo quadro:");
    if (!nome || !nome.trim()) return;
    const newBoard = {
      id: "board-" + Date.now(),
      nome: nome.trim(),
      dono_id: userEmail,
      members: [{ email: userEmail, papel: "OWNER" }]
    };
    db.boards.push(newBoard);
    saveDB(db);
    currentBoardId = newBoard.id;
    localStorage.setItem("asper_active_board", currentBoardId);
    render();
    showToast("Quadro criado!");
  });

  // Modal Nova Tarefa
  const taskDialog = document.getElementById("task-dialog");
  const taskForm = document.getElementById("task-form");
  addTaskBtn.addEventListener("click", () => {
    const board = getCurrentBoard();
    const assigneeSelect = document.getElementById("task-assignee");
    assigneeSelect.innerHTML = `<option value="">Sem responsável</option>`;
    board.members.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.email;
      opt.textContent = m.email;
      assigneeSelect.append(opt);
    });
    taskForm.reset();
    taskDialog.showModal();
  });

  document.getElementById("close-task-dialog").addEventListener("click", () => taskDialog.close());
  document.getElementById("cancel-task").addEventListener("click", () => taskDialog.close());

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const board = getCurrentBoard();
    if (getUserRole(board) === "VIEWER") return;
    const title = document.getElementById("task-title").value.trim();
    if (!title) return;

    const newTask = {
      id: "task-" + Date.now(),
      board_id: board.id,
      title,
      description: document.getElementById("task-description").value.trim(),
      status: "todo",
      priority: document.getElementById("task-priority").value,
      label: document.getElementById("task-label").value,
      dueDate: document.getElementById("task-due").value,
      points: Number(document.getElementById("task-points").value) || 1,
      assignee: document.getElementById("task-assignee").value,
      checklist: [],
      comments: [],
      acceptanceCriteria: ""
    };
    db.tasks.push(newTask);
    saveDB(db);
    taskDialog.close();
    render();
    showToast("Tarefa criada!");
  });

  // Modal Compartilhar Quadro
  const shareDialog = document.getElementById("share-dialog");
  function renderMembers() {
    const board = getCurrentBoard();
    const list = document.getElementById("members-list");
    list.innerHTML = "";
    board.members.forEach((m) => {
      const div = document.createElement("div");
      div.className = "member-item";
      div.innerHTML = `<span>${m.email} <strong>(${ROLE_LABELS[m.papel]})</strong></span>`;
      if (m.papel !== "OWNER") {
        const rmBtn = document.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "button button-ghost";
        rmBtn.textContent = "Remover";
        rmBtn.addEventListener("click", () => {
          board.members = board.members.filter((item) => item.email !== m.email);
          saveDB(db);
          renderMembers();
          showToast("Acesso removido.");
        });
        div.append(rmBtn);
      }
      list.append(div);
    });
  }

  shareBtn.addEventListener("click", () => {
    renderMembers();
    shareDialog.showModal();
  });
  document.getElementById("close-share-dialog").addEventListener("click", () => shareDialog.close());

  document.getElementById("invite-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const board = getCurrentBoard();
    if (getUserRole(board) !== "OWNER") return;
    const email = document.getElementById("invite-email").value.trim().toLowerCase();
    const papel = document.getElementById("invite-role").value;
    if (!email) return;

    const existing = board.members.find((m) => m.email === email);
    if (existing) {
      existing.papel = papel;
    } else {
      board.members.push({ email, papel });
    }
    saveDB(db);
    document.getElementById("invite-email").value = "";
    renderMembers();
    showToast(`Convite atualizado para ${email}!`);
  });

  // Atualiza automaticamente quando a aba da task altera algo
  window.addEventListener("storage", () => render());
  render();
})();