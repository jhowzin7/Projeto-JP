(() => {
  "use strict";

  // This front-end-only authentication is a simulation; production authentication must run on a server.
  const USERS_KEY = "asper_users";
  const SESSION_KEY = "asper_session";
  const FLASH_KEY = "asper_flash";
  const page = document.body.dataset.page;

  function readUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const users = JSON.parse(raw);
    if (!Array.isArray(users)) throw new Error("Os dados de contas salvos neste navegador estão inválidos.");
    return users;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function createId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    if (!crypto.subtle) throw new Error("A criptografia segura não está disponível. Abra o site em HTTPS ou em localhost.");
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  function getCurrentUser() {
    const rawSession = sessionStorage.getItem(SESSION_KEY);
    if (!rawSession) return null;
    try {
      const session = JSON.parse(rawSession);
      if (!session || typeof session.userId !== "string") return null;
      const user = readUsers().find((item) => item.id === session.userId);
      return user ? { id: user.id, username: user.username, name: user.name, email: user.email } : null;
    } catch (error) {
      console.error("Não foi possível ler a sessão do Asper.", error);
      return null;
    }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(FLASH_KEY, "Você saiu da sua conta.");
    window.location.assign("login.html");
  }

  function updateUserName(name) {
    const current = getCurrentUser();
    if (!current) throw new Error("Sua sessão expirou. Entre novamente.");
    const users = readUsers();
    const index = users.findIndex((user) => user.id === current.id);
    if (index < 0) throw new Error("Não foi possível encontrar sua conta.");
    users[index].name = name;
    saveUsers(users);
    return { ...current, name };
  }

  function showFlashMessage() {
    const message = sessionStorage.getItem(FLASH_KEY);
    if (!message) return;
    sessionStorage.removeItem(FLASH_KEY);
    const status = document.getElementById("auth-message");
    if (status) {
      status.textContent = message;
      status.classList.add("is-success");
    }
  }

  function setMessage(message, success) {
    const status = document.getElementById("auth-message");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-success", Boolean(success));
  }

  function setFieldError(input, message) {
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message;
  }

  function clearFormErrors(form) {
    form.querySelectorAll("input").forEach((input) => setFieldError(input, ""));
    setMessage("", false);
  }

  function initializePasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Ocultar" : "Mostrar";
        button.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
        button.setAttribute("aria-pressed", String(reveal));
      });
    });
  }

  function initializeLogin() {
    showFlashMessage();
    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");
    const loginPanel = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");
    const title = document.getElementById("auth-title-text");
    const description = document.getElementById("auth-description");

    function selectTab(register) {
      loginTab.classList.toggle("is-active", !register);
      registerTab.classList.toggle("is-active", register);
      loginTab.setAttribute("aria-selected", String(!register));
      registerTab.setAttribute("aria-selected", String(register));
      loginPanel.hidden = register;
      registerPanel.hidden = !register;
      title.textContent = register ? "Crie sua conta" : "Entre no Asper";
      description.textContent = register ? "Crie seu espaço e comece a organizar." : "Acesse seu quadro e continue de onde parou.";
      setMessage("", false);
    }

    loginTab.addEventListener("click", () => selectTab(false));
    registerTab.addEventListener("click", () => selectTab(true));
    if (window.location.hash === "#criar-conta") selectTab(true);
    initializePasswordToggles();

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    [loginForm, registerForm].forEach((form) => {
      form.addEventListener("input", (event) => {
        if (event.target.matches("input")) setFieldError(event.target, "");
        setMessage("", false);
      });
    });

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFormErrors(loginForm);
      const identity = loginForm.elements.identity.value.trim();
      const password = loginForm.elements.password.value;
      let firstInvalid = null;
      if (!identity) {
        setFieldError(loginForm.elements.identity, "Informe seu e-mail ou nome de usuário.");
        firstInvalid = loginForm.elements.identity;
      }
      if (!password) {
        setFieldError(loginForm.elements.password, "Informe sua senha.");
        firstInvalid ||= loginForm.elements.password;
      }
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      try {
        const users = readUsers();
        const normalized = identity.toLocaleLowerCase("pt-BR");
        const user = users.find((item) => item.username.toLocaleLowerCase("pt-BR") === normalized || item.email.toLocaleLowerCase("pt-BR") === normalized);
        if (!user || !user.salt || !user.passwordHash || (await hashPassword(password, user.salt)) !== user.passwordHash) {
          setMessage("E-mail/usuário ou senha incorretos.", false);
          return;
        }
        setSession(user);
        window.location.assign("kanban.html");
      } catch (error) {
        console.error("Falha ao autenticar no Asper.", error);
        setMessage(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.", false);
      }
    });

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFormErrors(registerForm);
      const name = registerForm.elements.name.value.trim();
      const email = registerForm.elements.email.value.trim();
      const password = registerForm.elements.password.value;
      let firstInvalid = null;
      if (name.length < 2) {
        setFieldError(registerForm.elements.name, "Informe um nome com pelo menos 2 caracteres.");
        firstInvalid = registerForm.elements.name;
      }
      if (!registerForm.elements.email.validity.valid || !email) {
        setFieldError(registerForm.elements.email, "Informe um endereço de e-mail válido.");
        firstInvalid ||= registerForm.elements.email;
      }
      if (password.length < 8) {
        setFieldError(registerForm.elements.password, "A senha deve ter pelo menos 8 caracteres.");
        firstInvalid ||= registerForm.elements.password;
      }
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      try {
        const users = readUsers();
        const normalizedName = name.toLocaleLowerCase("pt-BR");
        const normalizedEmail = email.toLocaleLowerCase("pt-BR");
        if (users.some((user) => user.username.toLocaleLowerCase("pt-BR") === normalizedName)) {
          setFieldError(registerForm.elements.name, "Esse nome de usuário já está em uso.");
          registerForm.elements.name.focus();
          return;
        }
        if (users.some((user) => user.email.toLocaleLowerCase("pt-BR") === normalizedEmail)) {
          setFieldError(registerForm.elements.email, "Já existe uma conta com este e-mail.");
          registerForm.elements.email.focus();
          return;
        }
        const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
        const user = {
          id: createId(),
          username: name,
          name,
          email,
          salt,
          passwordHash: await hashPassword(password, salt)
        };
        saveUsers([...users, user]);
        setSession(user);
        window.location.assign("kanban.html");
      } catch (error) {
        console.error("Falha ao criar conta no Asper.", error);
        setMessage(error instanceof Error ? error.message : "Não foi possível criar a conta. Tente novamente.", false);
      }
    });
  }

  function initializeUserMenu(user) {
    const trigger = document.getElementById("user-menu-trigger");
    const panel = document.getElementById("user-menu-panel");
    const avatar = document.getElementById("header-avatar");
    const profileAvatar = document.getElementById("profile-avatar");
    const headerName = document.getElementById("header-name");
    const profileName = document.getElementById("profile-name");
    const profileEmail = document.getElementById("profile-email");
    const nameInput = document.getElementById("display-name");

    function initials(name) {
      return name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] || "").join("").toLocaleUpperCase("pt-BR") || "A";
    }
    function renderProfile(current) {
      const mark = initials(current.name || current.username);
      avatar.textContent = mark;
      profileAvatar.textContent = mark;
      headerName.textContent = current.name || current.username;
      profileName.textContent = current.name || current.username;
      profileEmail.textContent = current.email;
      nameInput.value = current.name || current.username;
    }
    renderProfile(user);
    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (open) nameInput.focus();
    });
    document.addEventListener("click", (event) => {
      if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      }
    });
    document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", logout));
    document.getElementById("profile-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (name.length < 2) {
        nameInput.setCustomValidity("O nome deve ter pelo menos 2 caracteres.");
        nameInput.reportValidity();
        nameInput.setCustomValidity("");
        return;
      }
      try {
        const updated = updateUserName(name);
        renderProfile(updated);
        document.dispatchEvent(new CustomEvent("asper:profile-updated", { detail: updated }));
      } catch (error) {
        console.error("Falha ao salvar o perfil.", error);
        window.alert(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (page === "login") {
      if (getCurrentUser()) {
        window.location.replace("kanban.html");
        return;
      }
      initializeLogin();
      return;
    }
    if (page === "kanban") {
      const user = getCurrentUser();
      if (!user) {
        window.location.replace("login.html");
        return;
      }
      initializeUserMenu(user);
    }
  });

  window.AsperAuth = Object.freeze({ getCurrentUser, updateUserName, logout });
})();
