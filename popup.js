import { getItems, updateItem, deleteItem, searchItems, saveOrGetPage } from './storage.js';

const searchInput = document.getElementById('search');
const savePageBtn = document.getElementById('save-page-btn');
const statusEl = document.getElementById('status');
const itemsList = document.getElementById('items-list');
const emptyState = document.getElementById('empty-state');

// Item whose note textarea is currently open for editing, if any.
let editingNoteId = null;

const TYPE_ICON = { page: '📄', selection: '✂️' };

function showStatus(message) {
  statusEl.textContent = message;
  if (message) setTimeout(() => { if (statusEl.textContent === message) statusEl.textContent = ''; }, 2500);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function refresh() {
  const query = searchInput.value;
  const items = query.trim() ? await searchItems(query) : await getItems();
  render(items);
}

function render(items) {
  itemsList.innerHTML = '';
  emptyState.classList.toggle('hidden', items.length > 0);

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

  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title || '(untitled)';
  title.title = item.title || '';
  top.appendChild(title);

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
      note.textContent = `📝 ${item.note}`;
      li.appendChild(note);
    }
  }

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  const date = document.createElement('span');
  date.textContent = formatDate(item.createdAt);
  meta.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  if (item.url) {
    const openBtn = document.createElement('button');
    openBtn.className = 'btn link';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => chrome.tabs.create({ url: item.url }));
    actions.appendChild(openBtn);
  }

  if (item.type === 'page' && editingNoteId !== item.id) {
    const noteBtn = document.createElement('button');
    noteBtn.className = 'btn link';
    noteBtn.textContent = item.note ? 'Edit note' : 'Add note';
    noteBtn.addEventListener('click', () => {
      editingNoteId = item.id;
      refresh();
    });
    actions.appendChild(noteBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    await deleteItem(item.id);
    showStatus('Deleted');
    refresh();
  });
  actions.appendChild(deleteBtn);

  meta.appendChild(actions);
  li.appendChild(meta);

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
  saveBtn.textContent = 'Save note';
  saveBtn.addEventListener('click', async () => {
    await updateItem(item.id, { note: textarea.value.trim() });
    editingNoteId = null;
    showStatus('Note saved');
    refresh();
  });
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    editingNoteId = null;
    refresh();
  });
  actions.appendChild(cancelBtn);

  wrap.appendChild(actions);
  return wrap;
}

savePageBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const { created } = await saveOrGetPage({ title: tab.title || tab.url, url: tab.url });
  showStatus(created ? 'Page saved' : 'Already saved — saved earlier');
  refresh();
});

searchInput.addEventListener('input', refresh);

refresh();
