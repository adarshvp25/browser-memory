// Storage abstraction layer.
//
// This is the ONLY module that talks to chrome.storage.local. Popup and
// background code call these functions instead of the storage API directly,
// so a future version can swap local storage for a synced/remote backend
// without touching any UI or feature code.

const STORAGE_KEY = 'items';

async function readAll() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function writeAll(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

// Normalizes a URL for duplicate comparison: drops the fragment, lowercases
// the host, and strips a trailing slash from the path. Falls back to the
// raw (trimmed) string if the URL can't be parsed.
export function normalizeUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? ':' + u.port : ''}${path}${u.search}`;
  } catch {
    return rawUrl.trim();
  }
}

export async function getItems() {
  return readAll();
}

export async function addItem(item) {
  const items = await readAll();
  const newItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: item.type,
    title: item.title || '',
    content: item.content || '',
    note: item.note || '',
    url: item.url || null,
  };
  items.unshift(newItem);
  await writeAll(items);
  return newItem;
}

// Saves a webpage, unless a page with the same normalized URL already
// exists — in which case the existing item is returned unchanged. This is
// the single place "duplicate save" is decided, so both the popup button
// and the keyboard shortcut stay in sync.
export async function saveOrGetPage({ title, url }) {
  const items = await readAll();
  const normalized = normalizeUrl(url);
  const existing = items.find((item) => item.type === 'page' && normalizeUrl(item.url) === normalized);
  if (existing) {
    return { item: existing, created: false };
  }
  const newItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: 'page',
    title: title || url,
    content: '',
    note: '',
    url,
  };
  items.unshift(newItem);
  await writeAll(items);
  return { item: newItem, created: true };
}

export async function updateItem(id, changes) {
  const items = await readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...changes, updatedAt: Date.now() };
  await writeAll(items);
  return items[index];
}

export async function deleteItem(id) {
  const items = await readAll();
  await writeAll(items.filter((item) => item.id !== id));
}

export async function searchItems(query) {
  const items = await readAll();
  const q = (query || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    (item.title || '').toLowerCase().includes(q) ||
    (item.content || '').toLowerCase().includes(q) ||
    (item.note || '').toLowerCase().includes(q) ||
    (item.url || '').toLowerCase().includes(q)
  );
}
