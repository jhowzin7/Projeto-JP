const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const dashboardThemeToggle = document.getElementById('dashboardThemeToggle');
const password = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');
const loginForm = document.getElementById('loginForm');
const formMessage = document.getElementById('formMessage');
const nameField = document.getElementById('nameField');
const nameInput = document.getElementById('name');
const usernameField = document.getElementById('usernameField');
const usernameInput = document.getElementById('username');
const confirmField = document.getElementById('confirmField');
const confirmPassword = document.getElementById('confirmPassword');
const THEME_KEY = 'aster-theme';
const ACCOUNTS_KEY = 'aster-accounts';
const SESSION_KEY = 'aster-session';
const PASSWORD_ITERATIONS = 120000;
let mode = 'login';
let currentAccount = null;

function setFormMessage(message, type = '') {
  formMessage.textContent = message;
  formMessage.classList.toggle('error', type === 'error');
  formMessage.classList.toggle('success', type === 'success');
}

function setTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === 'dark';
  [themeToggle, dashboardThemeToggle].forEach(button => {
    button.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';
    button.querySelector('.theme-label').textContent = isDark ? 'Tema claro' : 'Tema escuro';
  });
}

try {
  const savedTheme = localStorage.getItem(THEME_KEY);
  setTheme(savedTheme === 'dark' ? 'dark' : 'light');
} catch (error) {
  setTheme('light');
}

function toggleTheme() {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    setFormMessage('A preferência de tema não pôde ser salva neste navegador.', 'error');
  }
}

themeToggle.addEventListener('click', toggleTheme);
dashboardThemeToggle.addEventListener('click', toggleTheme);

function setMode(nextMode) {
  mode = nextMode === 'signup' ? 'signup' : 'login';
  const signingUp = mode === 'signup';
  document.getElementById('formEyebrow').textContent = signingUp ? 'COMECE SUA JORNADA' : 'BEM-VINDO DE VOLTA';
  document.getElementById('login-title').textContent = signingUp ? 'Crie sua conta' : 'Acesse sua conta';
  document.getElementById('formDescription').textContent = signingUp
    ? 'Preencha seus dados para fazer parte da Aster.'
    : 'Que bom ter você por aqui. Entre com seus dados.';
  document.getElementById('submitButton').innerHTML = signingUp
    ? 'Criar conta <span aria-hidden="true">→</span>'
    : 'Entrar <span aria-hidden="true">→</span>';
  document.getElementById('modePrompt').innerHTML = signingUp
    ? 'Já tem uma conta? <a class="text-link" id="modeLink" href="#login">Entrar</a>'
    : 'Ainda não tem uma conta? <a class="text-link" id="modeLink" href="#signup">Criar conta</a>';
  nameField.hidden = !signingUp;
  nameInput.required = signingUp;
  usernameField.hidden = !signingUp;
  usernameInput.required = signingUp;
  document.getElementById('identifierLabel').textContent = signingUp ? 'E-mail' : 'E-mail ou nome de usuário';
  document.getElementById('email').placeholder = signingUp ? 'voce@exemplo.com' : 'voce@exemplo.com ou usuário';
  document.getElementById('email').autocomplete = signingUp ? 'email' : 'username';
  confirmField.hidden = !signingUp;
  confirmPassword.required = signingUp;
  confirmPassword.value = '';
  confirmPassword.setCustomValidity('');
  password.minLength = signingUp ? 8 : 0;
  password.autocomplete = signingUp ? 'new-password' : 'current-password';
  document.getElementById('rememberOption').hidden = signingUp;
  document.getElementById('forgotLink').hidden = signingUp;
  passwordToggle.setAttribute('aria-label', 'Mostrar senha');
  passwordToggle.title = 'Mostrar senha';
  password.type = 'password';
  setFormMessage('');
}

document.getElementById('modePrompt').addEventListener('click', event => {
  const link = event.target.closest('#modeLink');
  if (!link) return;
  event.preventDefault();
  const nextMode = link.getAttribute('href') === '#signup' ? 'signup' : 'login';
  history.replaceState(null, '', `#${nextMode}`);
  setMode(nextMode);
  (nextMode === 'signup' ? nameInput : document.getElementById('email')).focus();
});

setMode(location.hash === '#signup' ? 'signup' : 'login');
window.addEventListener('hashchange', () => {
  setMode(location.hash === '#signup' ? 'signup' : 'login');
});

passwordToggle.addEventListener('click', () => {
  const shouldShow = password.type === 'password';
  password.type = shouldShow ? 'text' : 'password';
  passwordToggle.setAttribute('aria-label', shouldShow ? 'Ocultar senha' : 'Mostrar senha');
  passwordToggle.title = shouldShow ? 'Ocultar senha' : 'Mostrar senha';
});

function readAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  const accounts = JSON.parse(raw);
  if (!Array.isArray(accounts) || accounts.some(account =>
    !account || typeof account.email !== 'string' || typeof account.name !== 'string'
    || typeof account.salt !== 'string' || typeof account.passwordHash !== 'string'
    || (account.username !== undefined && typeof account.username !== 'string')
  )) {
    throw new Error('Os dados das contas salvas estão inválidos.');
  }
  return accounts;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('O hash da senha salvo está inválido.');
  return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function hashPassword(value, salt) {
  if (!crypto.subtle) throw new Error('O cadastro seguro requer um navegador atualizado em uma conexão local ou HTTPS.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: PASSWORD_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function equalHashes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function showDashboard(account) {
  currentAccount = account;
  document.querySelector('.login-layout').hidden = true;
  document.getElementById('dashboard').hidden = false;
  document.getElementById('dashboardName').textContent = account.name;
  document.title = 'Meu Kanban | Aster';
  loadTasks();
}

function showLogin() {
  document.getElementById('dashboard').hidden = true;
  document.querySelector('.login-layout').hidden = false;
  document.title = 'Entrar | Aster';
  currentAccount = null;
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    const account = readAccounts().find(savedAccount => savedAccount.email === session.email);
    if (account) showDashboard(account);
  } catch (error) {
    setFormMessage('Não foi possível restaurar sua sessão. Entre novamente.', 'error');
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

confirmPassword.addEventListener('input', () => {
  confirmPassword.setCustomValidity(
    confirmPassword.value && confirmPassword.value !== password.value
      ? 'As senhas não coincidem.'
      : ''
  );
});
password.addEventListener('input', () => {
  if (confirmPassword.value) {
    confirmPassword.setCustomValidity(
      confirmPassword.value !== password.value ? 'As senhas não coincidem.' : ''
    );
  }
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  setFormMessage('');

  const identifier = document.getElementById('email').value.trim().toLowerCase();
  const submitButton = document.getElementById('submitButton');
  submitButton.disabled = true;

  try {
    const accounts = readAccounts();

    if (mode === 'signup') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        setFormMessage('Informe um endereço de e-mail válido.', 'error');
        document.getElementById('email').focus();
        return;
      }
      if (confirmPassword.value !== password.value) {
        confirmPassword.setCustomValidity('As senhas não coincidem.');
        confirmPassword.reportValidity();
        return;
      }
      const username = usernameInput.value.trim().toLowerCase();
      if (accounts.some(account => account.email.toLowerCase() === identifier)) {
        setFormMessage('Já existe uma conta com este e-mail. Entre ou use outro e-mail.', 'error');
        return;
      }
      if (accounts.some(account => account.username?.toLowerCase() === username)) {
        setFormMessage('Este nome de usuário já está em uso. Escolha outro.', 'error');
        return;
      }

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await hashPassword(password.value, salt);
      accounts.push({
        name: nameInput.value.trim(),
        email: identifier,
        username,
        salt: btoa(String.fromCharCode(...salt)),
        passwordHash
      });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      setMode('login');
      document.getElementById('email').value = identifier;
      document.getElementById('password').focus();
      setFormMessage('Conta criada com sucesso! Agora entre com seu e-mail ou nome de usuário e senha.', 'success');
      return;
    }

    const account = accounts.find(savedAccount =>
      savedAccount.email.toLowerCase() === identifier || savedAccount.username?.toLowerCase() === identifier
    );
    if (!account || !equalHashes(
      await hashPassword(password.value, base64ToBytes(account.salt)),
      account.passwordHash
    )) {
      setFormMessage('E-mail/nome de usuário ou senha incorretos.', 'error');
      return;
    }

    const sessionStore = loginForm.elements.remember.checked ? localStorage : sessionStorage;
    sessionStore.setItem(SESSION_KEY, JSON.stringify({ email: account.email }));
    showDashboard(account);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? 'Não foi possível ler as contas salvas neste navegador.'
      : error instanceof Error
        ? error.message
        : 'Não foi possível concluir a operação neste navegador.';
    setFormMessage(message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

const COLUMNS = [
  { id: 'todo', name: 'A Fazer', color: '#f59e0b' },
  { id: 'doing', name: 'Em Andamento', color: '#3b82f6' },
  { id: 'done', name: 'Concluído', color: '#10b981' }
];
const board = document.getElementById('board');
const storageStatus = document.getElementById('storageStatus');
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDescription = document.getElementById('taskDescription');
let tasks = [];
let dragId = null;

function taskStorageKey() {
  return `kanban-tasks-v1:${currentAccount.email}`;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(taskStorageKey());
    const savedTasks = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(savedTasks)) throw new Error('Os dados das tarefas estão inválidos.');
    tasks = savedTasks.filter(task => task && typeof task.id === 'string'
      && typeof task.title === 'string' && typeof task.desc === 'string'
      && COLUMNS.some(column => column.id === task.status));
    const shouldMigrate = !raw && localStorage.getItem('kanban-tasks-v1');
    if (shouldMigrate) {
      const previousTasks = localStorage.getItem('kanban-tasks-v1');
      const parsedTasks = JSON.parse(previousTasks);
      if (!Array.isArray(parsedTasks)) throw new Error('Os dados antigos das tarefas estão inválidos.');
      tasks = parsedTasks.filter(task => task && typeof task.id === 'string'
        && typeof task.title === 'string' && typeof task.desc === 'string'
        && COLUMNS.some(column => column.id === task.status));
    }
    saveTasks();
    if (shouldMigrate && !storageStatus.classList.contains('error')) {
      localStorage.removeItem('kanban-tasks-v1');
    }
    renderTasks();
  } catch (error) {
    storageStatus.textContent = error instanceof Error
      ? `Não foi possível carregar as tarefas: ${error.message}`
      : 'Não foi possível carregar as tarefas salvas.';
    storageStatus.classList.add('error');
    tasks = [];
    renderTasks();
  }
}

function saveTasks() {
  try {
    localStorage.setItem(taskStorageKey(), JSON.stringify(tasks));
    storageStatus.textContent = '';
    storageStatus.classList.remove('error');
  } catch (error) {
    storageStatus.textContent = 'Não foi possível salvar as alterações neste navegador.';
    storageStatus.classList.add('error');
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function renderTasks() {
  board.innerHTML = COLUMNS.map((column, columnIndex) => {
    const items = tasks.filter(task => task.status === column.id);
    const cards = items.map(task => {
      const previous = columnIndex > 0
        ? `<button class="icon" data-move="${task.id}" data-dir="-1" aria-label="Mover para a esquerda">←</button>` : '';
      const next = columnIndex < COLUMNS.length - 1
        ? `<button class="icon" data-move="${task.id}" data-dir="1" aria-label="Mover para a direita">→</button>` : '';
      return `<article class="card" draggable="true" data-id="${task.id}">
        <div class="card-top"><h3>${escapeHTML(task.title)}</h3>
          <button class="icon" data-del="${task.id}" aria-label="Excluir tarefa" title="Excluir">✕</button></div>
        ${task.desc ? `<p>${escapeHTML(task.desc)}</p>` : ''}
        <div class="moves">${previous}${next}</div>
      </article>`;
    }).join('');
    return `<section class="column" data-col="${column.id}">
      <div class="col-head"><span class="dot" style="background:${column.color}"></span>${column.name}<span class="count">${items.length}</span></div>
      <div class="list">${cards || '<div class="empty">Solte uma tarefa aqui</div>'}</div>
    </section>`;
  }).join('');
}

board.addEventListener('click', event => {
  const deleteButton = event.target.closest('[data-del]');
  if (deleteButton) {
    tasks = tasks.filter(task => task.id !== deleteButton.dataset.del);
    saveTasks();
    renderTasks();
    return;
  }
  const moveButton = event.target.closest('[data-move]');
  if (moveButton) {
    const task = tasks.find(item => item.id === moveButton.dataset.move);
    if (!task) return;
    const nextIndex = COLUMNS.findIndex(column => column.id === task.status) + Number(moveButton.dataset.dir);
    if (COLUMNS[nextIndex]) {
      task.status = COLUMNS[nextIndex].id;
      saveTasks();
      renderTasks();
    }
  }
});

board.addEventListener('dragstart', event => {
  const card = event.target.closest('.card');
  if (!card) return;
  dragId = card.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragId);
  setTimeout(() => card.classList.add('dragging'), 0);
});

board.addEventListener('dragend', () => {
  dragId = null;
  document.querySelectorAll('.dragging, .over').forEach(element => {
    element.classList.remove('dragging', 'over');
  });
});

board.addEventListener('dragover', event => {
  const column = event.target.closest('.column');
  if (!column || !dragId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.over').forEach(element => element.classList.remove('over'));
  column.classList.add('over');
});

board.addEventListener('dragleave', event => {
  const column = event.target.closest('.column');
  if (column && !column.contains(event.relatedTarget)) column.classList.remove('over');
});

board.addEventListener('drop', event => {
  const column = event.target.closest('.column');
  if (!column || !dragId) return;
  event.preventDefault();
  const task = tasks.find(item => item.id === dragId);
  if (!task) return;
  const over = event.target.closest('.card');
  tasks = tasks.filter(item => item.id !== dragId);
  task.status = column.dataset.col;
  let index = tasks.length;
  if (over && over.dataset.id !== dragId) {
    const rect = over.getBoundingClientRect();
    const targetIndex = tasks.findIndex(item => item.id === over.dataset.id);
    if (targetIndex > -1) index = event.clientY < rect.top + rect.height / 2 ? targetIndex : targetIndex + 1;
  }
  tasks.splice(index, 0, task);
  saveTasks();
  renderTasks();
});

document.getElementById('addTaskBtn').addEventListener('click', () => {
  taskForm.reset();
  taskModal.showModal();
  taskTitle.focus();
});
document.getElementById('cancelTask').addEventListener('click', () => taskModal.close());
taskModal.addEventListener('click', event => {
  if (event.target === taskModal) taskModal.close();
});
taskForm.addEventListener('submit', event => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;
  tasks.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title,
    desc: taskDescription.value.trim(),
    status: 'todo'
  });
  saveTasks();
  renderTasks();
  taskModal.close();
});

restoreSession();
