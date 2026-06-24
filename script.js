const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const daySelect = document.getElementById('day-select');
const loginButton = document.getElementById('login-button');
const themeToggleButton = document.getElementById('theme-toggle-button');
const pageHeader = document.querySelector('.page-header');
const titlePrefix = document.getElementById('page-title-message');
const currentDateTimeDisplay = document.getElementById('current-date-time');
const lockOverlay = document.getElementById('lock-overlay');
const lockLoginButton = document.getElementById('lock-login-button');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginNameInput = document.getElementById('login-name');
const loginPasswordInput = document.getElementById('login-password');
const rememberMeInput = document.getElementById('remember-me');
const cancelLoginButton = document.getElementById('cancel-login');
const loginError = document.getElementById('login-error');
const registerModeButton = document.getElementById('register-mode-button');
const genderSection = document.getElementById('gender-section');
const exitModal = document.getElementById('exit-modal');
const confirmExitButton = document.getElementById('confirm-exit');
const cancelExitButton = document.getElementById('cancel-exit');
const genderRadios = loginForm ? loginForm.querySelectorAll('input[name="gender"]') : [];

const bodyElement = document.body;
let currentUser = null;
let currentTasks = null; // { monday:[], tuesday:[], ... }
let isRegisterMode = false;
let draggedTask = null;
let rememberMeEnabled = localStorage.getItem('todoRememberMe') === 'on';

todoForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const taskText = todoInput.value.trim();
  const selectedDay = daySelect.value;

  if (!currentUser) {
    openLoginModal();
    setAppLocked(true);
    return;
  }

  if (taskText === '') {
    return;
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const taskObj = { id, text: taskText, done: false };
  // ensure currentTasks initialized
  if (!currentTasks) currentTasks = loadTasksForUser(currentUser);
  currentTasks[selectedDay] = currentTasks[selectedDay] || [];
  currentTasks[selectedDay].push(taskObj);
  saveTasksForUser(currentUser, currentTasks);

  const dayList = document.getElementById(`day-${selectedDay}`);
  dayList.appendChild(createTodoItemFromData(taskObj));
  todoInput.value = '';
  todoInput.focus();
});

themeToggleButton.addEventListener('click', function () {
  const isDarkMode = bodyElement.classList.toggle('dark-mode');
  localStorage.setItem('todoDarkMode', isDarkMode ? 'on' : 'off');
  updateThemeButton(isDarkMode);
});

function setAppLocked(locked) {
  if (lockOverlay) {
    lockOverlay.classList.toggle('hidden', !locked);
  }
  todoInput.disabled = locked;
  daySelect.disabled = locked;
  const addButton = document.querySelector('.add-button');
  if (addButton) addButton.disabled = locked;
  document.querySelectorAll('.task-checkbox, .remove').forEach(el => {
    el.disabled = locked;
  });
  document.querySelectorAll('.todo-item').forEach(item => {
    item.draggable = !locked;
  });
}

function ensureAuthenticated() {
  if (!currentUser) {
    openLoginModal();
    setAppLocked(true);
    return false;
  }
  return true;
}

if (lockLoginButton) {
  lockLoginButton.addEventListener('click', openLoginModal);
}

function updateHeaderDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  if (currentDateTimeDisplay) {
    currentDateTimeDisplay.textContent =
      dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' • ' + timeStr;
  }
}

setInterval(updateHeaderDateTime, 1000);
updateHeaderDateTime();

function getStoredUserName() {
  return rememberMeEnabled
    ? localStorage.getItem('todoUserName')
    : (sessionStorage.getItem('todoUserName') || null);
}

function getStoredUserGender() {
  return rememberMeEnabled
    ? localStorage.getItem('todoUserGender')
    : (sessionStorage.getItem('todoUserGender') || null);
}

function persistAuthSession(name, gender, remember) {
  rememberMeEnabled = !!remember;
  localStorage.setItem('todoRememberMe', rememberMeEnabled ? 'on' : 'off');

  if (rememberMeEnabled) {
    localStorage.setItem('todoUserName', name);
    localStorage.setItem('todoUserGender', gender || '');
    sessionStorage.removeItem('todoUserName');
    sessionStorage.removeItem('todoUserGender');
  } else {
    sessionStorage.setItem('todoUserName', name);
    sessionStorage.setItem('todoUserGender', gender || '');
    localStorage.removeItem('todoUserName');
    localStorage.removeItem('todoUserGender');
  }
}

function clearAuthSession() {
  localStorage.removeItem('todoUserName');
  localStorage.removeItem('todoUserGender');
  sessionStorage.removeItem('todoUserName');
  sessionStorage.removeItem('todoUserGender');
}

loginButton.addEventListener('click', function () {
  if (currentUser) {
    openExitModal();
    return;
  }

  openLoginModal();
});

// lock interactions until user logs in
if (!getStoredUserName()) {
  setAppLocked(true);
}

// helper: users stored in localStorage under 'todoUsers' as { name: { salt, hash, gender } }
function getUsers() {
  try {
    const stored = localStorage.getItem('todoUsers');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Erro ao carregar usuários:', e);
    return {};
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem('todoUsers', JSON.stringify(users));
  } catch (e) {
    console.error('Erro ao salvar usuários:', e);
    throw new Error('Não foi possível salvar os dados. Verifique o espaço de armazenamento.');
  }
}

function bufToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function hashPassword(password, saltBuffer) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return derived; // ArrayBuffer
}

async function registerUser(name, gender, password) {
  const users = getUsers();
  if (users[name]) throw new Error('Usuário já existe');
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBuf = await hashPassword(password, salt.buffer);
  
  users[name] = { 
    salt: bufToBase64(salt.buffer), 
    hash: bufToBase64(hashBuf), 
    gender 
  };
  
  saveUsers(users);
  
  // Store current user data in localStorage
  localStorage.setItem('todoUserName', name);
  localStorage.setItem('todoUserGender', gender);
  localStorage.setItem(`todoNewUser_${name}`, 'true');
}

async function authenticateUser(name, password) {
  try {
    const users = getUsers();
    const entry = users[name];
    if (!entry) return false;
    
    const saltBuf = base64ToBuf(entry.salt);
    const candidateBuf = await hashPassword(password, saltBuf);
    const isValid = bufToBase64(candidateBuf) === entry.hash;
    
    return isValid;
  } catch (e) {
    console.error('Erro na autenticação:', e);
    return false;
  }
}

// Update submit button text based on register mode
const loginSubmitButton = document.getElementById('submit-login');
if (registerModeButton) {
  registerModeButton.addEventListener('click', function () {
    setRegisterMode(!isRegisterMode);
  });
}

function setRegisterMode(enabled) {
  isRegisterMode = enabled;
  if (genderSection) {
    genderSection.classList.toggle('hidden', !enabled);
  }
  if (loginSubmitButton) {
    loginSubmitButton.textContent = enabled ? 'Registrar' : 'Entrar';
  }
  if (registerModeButton) {
    registerModeButton.textContent = enabled ? 'Voltar ao login' : 'Registrar novo usuário';
  }
  if (loginPasswordInput) {
    loginPasswordInput.autocomplete = enabled ? 'new-password' : 'current-password';
  }
  updateGenderSelectionHighlight();
}

function updateGenderSelectionHighlight() {
  if (!genderRadios || !genderRadios.length) return;
  genderRadios.forEach(radio => {
    const optionLabel = radio.closest('label');
    if (!optionLabel) return;
    optionLabel.classList.remove('selected-male', 'selected-female', 'selected-other');
    if (!radio.checked) return;
    if (radio.value === 'male') optionLabel.classList.add('selected-male');
    else if (radio.value === 'female') optionLabel.classList.add('selected-female');
    else optionLabel.classList.add('selected-other');
  });
}

if (genderRadios && genderRadios.length) {
  genderRadios.forEach(radio => {
    radio.addEventListener('change', updateGenderSelectionHighlight);
  });
}

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  const typedName = loginNameInput.value.trim();
  const selectedGender = Array.from(loginForm.querySelectorAll('input[name="gender"]')).find(r => r.checked)?.value || '';
  const password = (loginPasswordInput && loginPasswordInput.value) || '';

  if (typedName === '') {
    setLoginError('Por favor, informe seu nome.');
    return;
  }

  if (!password) {
    setLoginError('Por favor, informe uma senha.');
    return;
  }

  try {
    let finalGender = selectedGender;
    
    if (isRegisterMode) {
      if (!selectedGender) {
        setLoginError('Escolha sua identidade: Homem, Mulher ou Outro.');
        return;
      }
      const users = getUsers();
      if (users[typedName]) {
        setLoginError('Usuário já existe. Faça login ou escolha outro nome.');
        return;
      }
      await registerUser(typedName, selectedGender, password);
    } else {
      const users = getUsers();
      if (!users[typedName]) {
        setLoginError('Usuário não encontrado. Use registrar novo usuário para criar conta.');
        return;
      }
      const ok = await authenticateUser(typedName, password);
      if (!ok) {
        setLoginError('Senha incorreta.');
        return;
      }
      finalGender = users[typedName].gender || '';
    }

    setLoginError('');
    const isNewUser = isRegisterMode;
    const currentGender = finalGender;
    
    if (isNewUser) {
      setTimeout(() => localStorage.removeItem(`todoNewUser_${typedName}`), 100);
    }
    
    updateUserName(typedName, isNewUser);
    updateGender(currentGender);
    persistAuthSession(typedName, currentGender, !!(rememberMeInput && rememberMeInput.checked));
    closeLoginModal();
    setAppLocked(false);
  } catch (err) {
    setLoginError(err.message || 'Erro ao processar requisição.');
  }
});

cancelLoginButton.addEventListener('click', function () {
  closeLoginModal();
});

function openLoginModal() {
  const savedName = getStoredUserName();
  const savedGender = getStoredUserGender();

  loginModal.classList.remove('hidden');
  loginNameInput.value = savedName || '';

  // reset password and register mode
  if (loginPasswordInput) loginPasswordInput.value = '';
  setRegisterMode(false);

  // Correctly set radio button values
  loginForm.querySelectorAll('input[name="gender"]').forEach(radio => {
    radio.checked = radio.value === savedGender;
  });

  updateGenderSelectionHighlight();

  if (rememberMeInput) {
    rememberMeInput.checked = rememberMeEnabled;
  }

  setLoginError('');
  loginNameInput.focus();
}

function closeLoginModal() {
  loginModal.classList.add('hidden');
}

function openExitModal() {
  if (!exitModal) return;
  exitModal.classList.remove('hidden');
  confirmExitButton.focus();
}

function closeExitModal() {
  if (!exitModal) return;
  exitModal.classList.add('hidden');
}

function setLoginError(message) {
  loginError.textContent = message;
  loginError.classList.toggle('hidden', !message);
}

function generateHeaderMessage(name, gender, isNewUser) {
  if (isNewUser) {
    if (gender === 'female') {
      return `Que bom ter você aqui! ${name}! Seja bem vinda`;
    } else if (gender === 'male') {
      return `Que bom ter você aqui! ${name}! Seja bem-vindo`;
    } else {
      return `Que bom ter você aqui! ${name}! Seja bem-vindo(a)`;
    }
  } else {
    return `É bom ver você, ${name}! o que vamos fazer hoje?`;
  }
}

function updateUserName(name, isNewUser = false) {
  try {
    if (name) {
      const messageText = generateHeaderMessage(name, getStoredUserGender(), isNewUser);
      titlePrefix.textContent = messageText;
      loginButton.textContent = 'Sair';
      currentUser = name;
      // load and render tasks for this user
      currentTasks = loadTasksForUser(currentUser);
      renderTasks(currentTasks);
      setAppLocked(false);
    } else {
      titlePrefix.textContent = 'Bem-vindo!';
      loginButton.textContent = 'Login / Registrar';
      clearAuthSession();
      currentUser = null;
      currentTasks = null;
      clearAllDayLists();
      setAppLocked(true);
    }
  } catch (e) {
    console.error('Erro ao atualizar usuário:', e);
  }
}

function updateGender(gender) {
  try {
    // Apply header style according to gender
    if (pageHeader) {
      pageHeader.classList.toggle('gender-male', gender === 'male');
      pageHeader.classList.toggle('gender-female', gender === 'female');
      pageHeader.classList.toggle('gender-other', gender === 'other');
    }
    if (bodyElement) {
      bodyElement.classList.toggle('gender-male', gender === 'male');
      bodyElement.classList.toggle('gender-female', gender === 'female');
      bodyElement.classList.toggle('gender-other', gender === 'other');
    }
    if (!gender) {
      localStorage.removeItem('todoUserGender');
      sessionStorage.removeItem('todoUserGender');
    }
  } catch (e) {
    console.error('Erro ao atualizar gênero:', e);
  }
}

// Tasks persistence per user
function getTasksKey(user) {
  if (!user) return 'todoGuest';
  return `todoData_${user}`;
}

function defaultTasksObj() {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  };
}

function saveTasksForUser(user, tasksObj) {
  const key = getTasksKey(user);
  try {
    localStorage.setItem(key, JSON.stringify(tasksObj));
  } catch (e) {
    console.error('Falha ao salvar tarefas:', e);
    alert('Aviso: Não foi possível salvar suas tarefas. Verifique o espaço de armazenamento.');
  }
}

function loadTasksForUser(user) {
  const key = getTasksKey(user);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultTasksObj();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultTasksObj(), parsed);
  } catch (e) {
    console.error('Erro ao carregar tarefas:', e);
    return defaultTasksObj();
  }
}

function clearAllDayLists() {
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(d => {
    const ul = document.getElementById(`day-${d}`);
    if (ul) ul.innerHTML = '';
  });
}

function renderTasks(tasksObj) {
  if (!tasksObj) tasksObj = defaultTasksObj();
  clearAllDayLists();
  Object.keys(tasksObj).forEach(day => {
    const list = document.getElementById(`day-${day}`);
    if (!list) return;
    tasksObj[day].forEach(task => {
      list.appendChild(createTodoItemFromData(task));
    });
  });
}

function findTaskById(id) {
  if (!currentTasks || !id) return null;
  for (const day of Object.keys(currentTasks)) {
    const found = (currentTasks[day] || []).find(task => task.id === id);
    if (found) return found;
  }
  return null;
}

function syncTasksFromDOM() {
  if (!currentUser) return;
  const nextTasks = defaultTasksObj();

  Object.keys(nextTasks).forEach(day => {
    const list = document.getElementById(`day-${day}`);
    if (!list) return;

    list.querySelectorAll('.todo-item').forEach(item => {
      const id = item.dataset.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      item.dataset.id = id;
      const text = (item.querySelector('.task-text')?.textContent || '').trim();
      const done = !!item.querySelector('.task-checkbox')?.checked;
      const previous = findTaskById(id);
      const completedAt = done ? (previous?.completedAt || null) : null;
      if (text) {
        nextTasks[day].push({ id, text, done, completedAt });
      }
    });
  });

  currentTasks = nextTasks;
  saveTasksForUser(currentUser, currentTasks);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  draggableElements.forEach(child => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  });

  return closest.element;
}

function setupDragAndDropLists() {
  document.querySelectorAll('.day-list').forEach(list => {
    list.addEventListener('dragover', function (event) {
      if (!draggedTask || !currentUser) return;
      event.preventDefault();
      const afterElement = getDragAfterElement(list, event.clientY);
      if (!afterElement) {
        list.appendChild(draggedTask);
      } else {
        list.insertBefore(draggedTask, afterElement);
      }
    });

    list.addEventListener('drop', function (event) {
      if (!draggedTask || !currentUser) return;
      event.preventDefault();
      syncTasksFromDOM();
    });
  });
}

function createTodoItemFromData(taskObj) {
  const listItem = createTodoItem(taskObj.text, taskObj.id, taskObj.done, taskObj.completedAt);
  const checkbox = listItem.querySelector('.task-checkbox');
  if (checkbox) checkbox.checked = !!taskObj.done;
  if (taskObj.done) listItem.classList.add('done');
  return listItem;
}

function closeAllTaskTooltips(exceptItem = null) {
  document.querySelectorAll('.todo-item.tooltip-visible').forEach(item => {
    if (item !== exceptItem) {
      item.classList.remove('tooltip-visible');
    }
  });
}

function formatCompletedTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function parseTimeValue(value) {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isInteger(hours) && Number.isInteger(minutes)) {
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    return now.toISOString();
  }
  return null;
}

function updateTaskDoneById(id, done, completedAt) {
  if (!currentTasks) return;
  let changed = false;
  Object.keys(currentTasks).forEach(day => {
    const idx = (currentTasks[day] || []).findIndex(t => t.id === id);
    if (idx >= 0) {
      currentTasks[day][idx].done = !!done;
      currentTasks[day][idx].completedAt = completedAt || null;
      changed = true;
    }
  });
  if (changed) saveTasksForUser(currentUser, currentTasks);
}

function removeTaskById(day, id) {
  if (!currentTasks) currentTasks = loadTasksForUser(currentUser);
  currentTasks[day] = (currentTasks[day] || []).filter(t => t.id !== id);
  saveTasksForUser(currentUser, currentTasks);
}

// Exit modal handlers
if (confirmExitButton) {
  confirmExitButton.addEventListener('click', function () {
    updateUserName('');
    updateGender('');
    closeExitModal();
  });
}

if (cancelExitButton) {
  cancelExitButton.addEventListener('click', function () {
    closeExitModal();
  });
}

// Check if localStorage is available
function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// Warn user if localStorage is not available
if (!isLocalStorageAvailable()) {
  console.warn('LocalStorage não disponível. O aplicativo pode não funcionar corretamente.');
}

// Load initial state
const savedName = getStoredUserName();
const savedGender = getStoredUserGender();

if (savedName && typeof savedName === 'string' && savedName.trim().length > 0) {
  const isNewUser = !!localStorage.getItem(`todoNewUser_${savedName}`);
  updateUserName(savedName, isNewUser);
}
if (savedGender) {
  updateGender(savedGender);
}

if (!savedName) {
  setAppLocked(true);
}

const savedTheme = localStorage.getItem('todoDarkMode');
const isDarkMode = savedTheme === 'on';
if (isDarkMode) {
  bodyElement.classList.add('dark-mode');
}
updateThemeButton(isDarkMode);

function updateThemeButton(isDark) {
  if (!themeToggleButton) return;
  const nextLabel = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
  themeToggleButton.textContent = isDark ? '☾' : '☀';
  themeToggleButton.setAttribute('aria-label', nextLabel);
  themeToggleButton.setAttribute('title', nextLabel);
}

function createTodoItem(text, id, done = false, completedAt = null) {
  const listItem = document.createElement('li');
  listItem.className = 'todo-item';
  if (id) listItem.dataset.id = id;
  listItem.setAttribute('aria-label', text);
  listItem.draggable = !todoInput.disabled;
  // entrance animation marker
  listItem.classList.add('task-enter');

  listItem.addEventListener('dragstart', function (event) {
    if (todoInput.disabled) {
      event.preventDefault();
      return;
    }
    draggedTask = listItem;
    listItem.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', listItem.dataset.id || '');
    }
  });

  listItem.addEventListener('dragend', function () {
    listItem.classList.remove('dragging');
    draggedTask = null;
  });

  const taskRow = document.createElement('div');
  taskRow.className = 'task-row';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = !!done;

  const taskText = document.createElement('span');
  taskText.className = 'task-text';
  taskText.textContent = text;
  taskText.tabIndex = 0;
  taskText.setAttribute('role', 'button');
  taskText.setAttribute('aria-label', 'Mostrar texto completo da tarefa');

  const taskTooltip = document.createElement('span');
  taskTooltip.className = 'task-tooltip';
  taskTooltip.textContent = text;

  const toggleTooltip = function () {
    const willShow = !listItem.classList.contains('tooltip-visible');
    closeAllTaskTooltips(willShow ? listItem : null);
    listItem.classList.toggle('tooltip-visible', willShow);
  };

  taskText.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    toggleTooltip();
  });

  taskText.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTooltip();
    }
  });

  // Checkbox toggles completion state; no completion label or time editor shown
  checkbox.addEventListener('change', function () {
    const checked = checkbox.checked;
    listItem.classList.toggle('done', checked);
    listItem.classList.remove('tooltip-visible');
    // small completion pulse
    if (checked) {
      listItem.classList.add('task-complete');
      setTimeout(() => listItem.classList.remove('task-complete'), 600);
    } else {
      listItem.classList.remove('task-complete');
    }
    const tid = listItem.dataset.id;
    if (tid) updateTaskDoneById(tid, checked, null);
  });

  taskRow.appendChild(checkbox);
  taskRow.appendChild(taskText);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', 'Remover tarefa');
  removeButton.addEventListener('click', function () {
    // animate removal, then persist and remove from DOM
    if (listItem.classList.contains('task-remove')) return;
    const tid = listItem.dataset.id;
    const parent = listItem.parentElement;
    listItem.classList.add('task-remove');

    const cleanUp = () => {
      if (tid && parent && parent.id) {
        const day = parent.id.replace('day-','');
        removeTaskById(day, tid);
      }
      if (listItem.parentElement) listItem.remove();
    };

    const onAnim = function () {
      listItem.removeEventListener('animationend', onAnim);
      cleanUp();
    };

    listItem.addEventListener('animationend', onAnim);
    // fallback: in case animationend doesn't fire, remove after duration
    setTimeout(() => {
      if (listItem.parentElement) {
        try { listItem.removeEventListener('animationend', onAnim); } catch (e) {}
        cleanUp();
      }
    }, 380);
  });

  actions.appendChild(removeButton);

  listItem.appendChild(taskRow);
  listItem.appendChild(taskTooltip);
  
  listItem.appendChild(actions);

  // remove entrance animation class after it finishes
  setTimeout(() => listItem.classList.remove('task-enter'), 320);

  return listItem;
}

document.addEventListener('click', function (event) {
  if (!event.target.closest('.todo-item')) {
    closeAllTaskTooltips();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeAllTaskTooltips();
  }
});

const mobileDayDrawerQuery = window.matchMedia('(max-width: 760px)');

function setDayDrawerCollapsed(dayColumn, heading, dayList, collapsed) {
  dayColumn.classList.toggle('drawer-collapsed', collapsed);
  dayList.hidden = collapsed;
  heading.setAttribute('aria-expanded', String(!collapsed));
}

function initMobileDayDrawers() {
  const isMobile = mobileDayDrawerQuery.matches;

  document.querySelectorAll('.day-column').forEach(dayColumn => {
    const heading = dayColumn.querySelector('h2');
    const dayList = dayColumn.querySelector('.day-list');
    if (!heading || !dayList) return;

    dayColumn.classList.add('drawer-enabled');
    heading.classList.add('day-drawer-toggle');
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');
    if (dayList.id) heading.setAttribute('aria-controls', dayList.id);

    let arrow = heading.querySelector('.drawer-arrow');
    if (!arrow) {
      arrow = document.createElement('span');
      arrow.className = 'drawer-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '▾';
      heading.appendChild(arrow);
    }

    if (!heading.dataset.drawerBound) {
      heading.addEventListener('click', function () {
        if (!mobileDayDrawerQuery.matches) return;
        const willCollapse = !dayColumn.classList.contains('drawer-collapsed');
        setDayDrawerCollapsed(dayColumn, heading, dayList, willCollapse);
      });

      heading.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          heading.click();
        }
      });

      heading.dataset.drawerBound = 'true';
    }

    if (isMobile) {
      if (!dayColumn.dataset.mobileDrawerReady) {
        setDayDrawerCollapsed(dayColumn, heading, dayList, true);
        dayColumn.dataset.mobileDrawerReady = 'true';
      }
    } else {
      setDayDrawerCollapsed(dayColumn, heading, dayList, false);
    }
  });
}

setupDragAndDropLists();
initMobileDayDrawers();

if (mobileDayDrawerQuery && typeof mobileDayDrawerQuery.addEventListener === 'function') {
  mobileDayDrawerQuery.addEventListener('change', initMobileDayDrawers);
}
