import { getItems, updateItem, deleteItem, searchItems, saveOrGetPage } from './storage.js';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfDPLjiH_7szzLiBBcJfm5U4iSQKEFF7w1Q3wQH6Y7Q5bOmxA/viewform?usp=dialog';

const searchInput = document.getElementById('search');
const savePageBtn = document.getElementById('save-page-btn');
const saveBtnLabel = document.getElementById('save-btn-label');
const statusEl = document.getElementById('status');
const listLabel = document.getElementById('list-label');
const itemsList = document.getElementById('items-list');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const noResultsText = document.getElementById('no-results-text');
const clearSearchBtn = document.getElementById('clear-search-btn');
const feedbackLink = document.getElementById('feedback-link');
const versionLabel = document.getElementById('version-label');

// Item whose note textarea is currently open for editing, if any.
let editingNoteId = null;
// Item whose Delete button is in the "click again to confirm" state.
let confirmDeleteId = null;
let confirmDeleteTimer = null;

const TYPE_ICON = { page: '📄', selection: '✂️' };

function showStatus(message, kind = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
  if (message) {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
        statusEl.className = 'status';
      }
    }, 3000);
  }
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function refresh() {
  const query = searchInput.value;
  const totalCount = (await getItems()).length;
  const items = query.trim() ? await searchItems(query) : await getItems();
  render(items, { totalCount, query: query.trim() });
}

function render(items, { totalCount, query }) {
  itemsList.innerHTML = '';

  const isSearching = query.length > 0;
  const showOnboarding = totalCount === 0;
  const showNoResults = !showOnboarding && isSearching && items.length === 0;
  const showList = items.length > 0;

  emptyState.classList.toggle('hidden', !showOnboarding);
  noResultsState.classList.toggle('hidden', !showNoResults);
  listLabel.classList.toggle('hidden', !showList || isSearching);
  itemsList.classList.toggle('hidden', !showList);

  if (showNoResults) {
    noResultsText.textContent = `No matches for "${query}"`;
  }

  for (const item of items) {
    itemsList.appendChild(renderItem(item));
  }
}

function renderItem(item) {
  const li = document.createElement('li');
  li.className = 'item';

  const top = document.createElement('div');
  top.className = 'item-top';

  const icon = document.createElement('span');
  icon.className = 'item-icon';
  icon.textContent = TYPE_ICON[item.type] || '•';
  top.appendChild(icon);

  const titleGroup = document.createElement('div');
  titleGroup.className = 'item-title-group';
  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title || '(untitled)';
  title.title = item.title || '';
  titleGroup.appendChild(title);
  top.appendChild(titleGroup);

  const time = document.createElement('span');
  time.className = 'item-time';
  time.textContent = formatRelativeTime(item.createdAt);
  time.title = new Date(item.createdAt).toLocaleString();
  top.appendChild(time);

  li.appendChild(top);

  // Selected-text items show the captured text as their snippet.
  if (item.type === 'selection' && item.content) {
    const snippet = document.createElement('div');
    snippet.className = 'item-snippet';
    snippet.textContent = item.content;
    li.appendChild(snippet);
  }

  if (item.type === 'page') {
    if (editingNoteId === item.id) {
      li.appendChild(renderNoteEditForm(item));
    } else if (item.note) {
      const note = document.createElement('div');
      note.className = 'item-note';
      note.textContent = item.note;
      li.appendChild(note);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  if (item.url) {
    const openBtn = document.createElement('button');
    openBtn.className = 'btn link';
    openBtn.type = 'button';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => chrome.tabs.create({ url: item.url }));
    actions.appendChild(openBtn);
  }

  if (item.type === 'page' && editingNoteId !== item.id) {
    const noteBtn = document.createElement('button');
    noteBtn.className = 'btn link';
    noteBtn.type = 'button';
    noteBtn.textContent = item.note ? 'Edit note' : 'Add note';
    noteBtn.addEventListener('click', () => {
      editingNoteId = item.id;
      refresh();
    });
    actions.appendChild(noteBtn);
  }

  const deleteBtn = document.createElement('button');
  const isConfirming = confirmDeleteId === item.id;
  deleteBtn.className = `btn danger${isConfirming ? ' confirming' : ''}`;
  deleteBtn.type = 'button';
  deleteBtn.textContent = isConfirming ? 'Confirm?' : 'Delete';
  deleteBtn.setAttribute('aria-label', isConfirming ? `Confirm delete "${item.title || 'item'}"` : `Delete "${item.title || 'item'}"`);
  deleteBtn.addEventListener('click', async () => {
    if (confirmDeleteId === item.id) {
      clearTimeout(confirmDeleteTimer);
      confirmDeleteId = null;
      await deleteItem(item.id);
      showStatus('Deleted', 'info');
      refresh();
    } else {
      confirmDeleteId = item.id;
      clearTimeout(confirmDeleteTimer);
      confirmDeleteTimer = setTimeout(() => {
        confirmDeleteId = null;
        refresh();
      }, 4000);
      refresh();
    }
  });
  actions.appendChild(deleteBtn);

  li.appendChild(actions);

  return li;
}

function renderNoteEditForm(item) {
  const wrap = document.createElement('div');
  wrap.className = 'note-form';

  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.placeholder = 'Why did you save this? What do you want to remember?';
  textarea.value = item.note || '';
  wrap.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'note-form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn primary';
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save note';
  saveBtn.addEventListener('click', async () => {
    await updateItem(item.id, { note: textarea.value.trim() });
    editingNoteId = null;
    showStatus('Note saved', 'success');
    refresh();
  });
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    editingNoteId = null;
    refresh();
  });
  actions.appendChild(cancelBtn);

  wrap.appendChild(actions);

  // Autofocus without stealing focus from prior interactions on first render.
  setTimeout(() => textarea.focus(), 0);

  return wrap;
}

function isSavableUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

async function updateSaveButtonState() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    tab = null;
  }

  if (!tab || !isSavableUrl(tab.url)) {
    savePageBtn.disabled = true;
    savePageBtn.title = "This page can't be saved.";
    saveBtnLabel.textContent = 'Save current page';
  } else {
    savePageBtn.disabled = false;
    savePageBtn.removeAttribute('title');
  }
}

savePageBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isSavableUrl(tab.url)) return;
  const { created } = await saveOrGetPage({ title: tab.title || tab.url, url: tab.url });
  showStatus(created ? '✓ Page saved' : 'Already saved — saved earlier', created ? 'success' : 'info');
  refresh();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  refresh();
});

searchInput.addEventListener('input', refresh);

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchInput.value) {
    searchInput.value = '';
    refresh();
  }
});

feedbackLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: FEEDBACK_URL });
});

versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;

updateSaveButtonState();
refresh();
