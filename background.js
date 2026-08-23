import { addItem, saveOrGetPage } from './storage.js';

const SELECTION_MENU_ID = 'browser-memory-save-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: SELECTION_MENU_ID,
    title: 'Save selection to Browser Memory',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== SELECTION_MENU_ID || !info.selectionText) return;
  await addItem({
    type: 'selection',
    title: tab?.title || 'Selected text',
    content: info.selectionText,
    url: tab?.url || null,
  });
  flashBadge({ text: '✓', color: '#2e7d32' });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const { created } = await saveOrGetPage({ title: tab.title || tab.url, url: tab.url });
  flashBadge(created ? { text: '✓', color: '#2e7d32' } : { text: '•', color: '#57606a' });
});

function flashBadge({ text, color }) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}
