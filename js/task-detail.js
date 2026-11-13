(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("id");
  const user = window.AsperAuth ? window.AsperAuth.getCurrentUser() : null;

  if (!user) {
    window.location.assign("login.html");
    return;
  }

  const userEmail = (user.email || user.id).toLowerCase();
  const DB_KEY = "asper_collab_db_v1";

  function loadDB() {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{"boards":[],"tasks":[]}');
  }
  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  let db = loadDB();
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) {
    document.body.innerHTML = "<p style='padding:40px'>Tarefa não encontrada.</p>";
    return;
  }

  const board = db.boards.find((b) => b.id === task.board_id);
  const member = board?.members.find((m) => m.email === userEmail);
  const role = board?.dono_id === userEmail ? "OWNER" : (member ? member.papel : null);

  if (!role) {
    document.body.innerHTML = "<p style='padding:40px'>Sem permissão para acessar esta tarefa.</p>";
    return;
  }

  const canEdit = role === "OWNER" || role === "EDITOR";
  document.getElementById("board-name-display").textContent = `${board.nome} • Seu papel: ${role}`;

  const fields = {
    title: document.getElementById("edit-title"),
    desc: document.getElementById("edit-desc"),
    status: document.getElementById("edit-status"),
    assignee: document.getElementById("edit-assignee"),
    priority: document.getElementById("edit-priority"),
    label: document.getElementById("edit-label"),
    due: document.getElementById("edit-due"),
    points: document.getElementById("edit-points"),
    criteria: document.getElementById("edit-criteria")
  };

  // Preenche responsáveis
  fields.assignee.innerHTML = `<option value="">Sem responsável</option>`;
  board.members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.email;
    opt.textContent = m.email;
    fields.assignee.append(opt);
  });

  fields.title.value = task.title;
  fields.desc.value = task.description || "";
  fields.status.value = task.status;
  fields.assignee.value = task.assignee || "";
  fields.priority.value = task.priority || "media";
  fields.label.value = task.label || "feature";
  fields.due.value = task.dueDate || "";
  fields.points.value = task.points || 1;
  fields.criteria.value = task.acceptanceCriteria || "";

  if (!canEdit) {
    Object.values(fields).forEach((el) => (el.disabled = true));
    document.getElementById("save-task-btn").style.display = "none";
    document.getElementById("checklist-form").style.display = "none";
  }

  document.getElementById("save-task-btn").addEventListener("click", () => {
    if (!canEdit) return;
    task.title = fields.title.value.trim() || task.title;
    task.description = fields.desc.value.trim();
    task.status = fields.status.value;
    task.assignee = fields.assignee.value;
    task.priority = fields.priority.value;
    task.label = fields.label.value;
    task.dueDate = fields.due.value;
    task.points = Number(fields.points.value) || 1;
    task.acceptanceCriteria = fields.criteria.value.trim();
    saveDB(db);
    alert("Alterações salvas e refletidas no quadro!");
  });

  // Checklist
  function renderChecklist() {
    task.checklist = task.checklist || [];
    const doneCount = task.checklist.filter((c) => c.done).length;
    const pct = task.checklist.length ? Math.round((doneCount / task.checklist.length) * 100) : 0;
    document.getElementById("checklist-progress").textContent = `${pct}%`;

    const container = document.getElementById("checklist-items");
    container.innerHTML = "";
    task.checklist.forEach((item, idx) => {
      const row = document.createElement("label");
      row.className = "check-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.done;
      cb.disabled = !canEdit;
      cb.addEventListener("change", () => {
        task.checklist[idx].done = cb.checked;
        saveDB(db);
        renderChecklist();
      });
      row.append(cb, document.createTextNode(item.text));
      container.append(row);
    });
  }

  document.getElementById("checklist-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const input = document.getElementById("new-subtask");
    if (!input.value.trim()) return;
    task.checklist.push({ text: input.value.trim(), done: false });
    input.value = "";
    saveDB(db);
    renderChecklist();
  });

  // Comentários
  function renderComments() {
    task.comments = task.comments || [];
    const container = document.getElementById("comments-list");
    container.innerHTML = "";
    task.comments.forEach((c) => {
      const div = document.createElement("div");
      div.className = "comment-box";
      div.innerHTML = `<strong>${c.author}</strong> <small style="color:var(--color-muted)">• ${c.date}</small><p style="margin-top:4px">${c.text}</p>`;
      container.append(div);
    });
  }

  document.getElementById("comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("new-comment");
    if (!input.value.trim()) return;
    task.comments.push({
      author: userEmail,
      date: new Date().toLocaleString("pt-BR"),
      text: input.value.trim()
    });
    input.value = "";
    saveDB(db);
    renderComments();
  });

  renderChecklist();
  renderComments();
})();