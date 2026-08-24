# Browser Memory

A small, local-first Chrome extension for saving useful things you find on
the web and finding them again later.

**The core loop:** find something useful -> save it -> forget about it ->
search for it later -> retrieve it.

Everything is stored on your machine with `chrome.storage.local`. There is
no account, no backend, no sync, and no tracking -- Browser Memory doesn't
talk to the network at all.

## Features (v1)

- Save the current webpage (toolbar button or keyboard shortcut) -- saving
  the same URL again is a no-op and shows "Already saved" instead of
  creating a duplicate
- Save selected text via the right-click context menu
- Attach an optional plain-text note to a saved page (why you saved it,
  what to remember about it)
- View recently saved items in the popup, with a first-use onboarding
  message when nothing has been saved yet
- Search across titles, URLs, selected text, and notes
- Open the original webpage for any saved page/selection
- Delete saved items (click Delete once to arm it, again to confirm --
  guards against an accidental, irreversible click)

## Development setup

There is no build step -- it's plain HTML/CSS/JS. Just load the folder as
an unpacked extension (see below) and reload it in `chrome://extensions`
after making changes.

## Loading the unpacked extension in Chrome

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this project folder (`browser-memory`).
5. The "Browser Memory" icon appears in your toolbar. Pin it for easy access.

After editing any file, click the refresh icon on the extension's card in
`chrome://extensions` to pick up the changes.

## Project structure

```
manifest.json    Extension manifest (MV3)
storage.js       Persistence layer -- the only file that touches chrome.storage.local
background.js    Service worker: context menu + keyboard shortcut handling
popup.html       Popup UI markup
popup.css        Popup styling (design tokens, light/dark themes)
popup.js         Popup logic: search, save, note editing, delete, open
icons/           Toolbar/store icons (16/48/128px)
```

### Why a storage abstraction?

`storage.js` exposes a small set of functions (`getItems`, `addItem`,
`saveOrGetPage`, `updateItem`, `deleteItem`, `searchItems`, `normalizeUrl`)
and is the *only* place that calls the `chrome.storage` API. The popup and
background script never touch `chrome.storage` directly. This means a
future version could swap local storage for a synced backend by changing
the inside of `storage.js` alone, without touching any UI or feature code.

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `storage` | Persist saved items locally via `chrome.storage.local` |
| `activeTab` | Read the active tab's URL/title when you trigger a save (clicking the toolbar icon, using the keyboard shortcut, or using the context menu all count as invocations that grant this) |
| `contextMenus` | Add the "Save selection to Browser Memory" right-click menu item |

No `tabs`, `scripting`, `host_permissions`, or network access are used.

## Storage approach

All items are stored as a single array under one key in
`chrome.storage.local`. Each item looks like:

```json
{
  "id": "uuid",
  "type": "page | selection",
  "title": "string",
  "content": "string (selected text for a selection; empty for a page)",
  "note": "string (optional, page items only)",
  "url": "string or null",
  "createdAt": 1699999999999
}
```

Saving a webpage checks for an existing item of type `page` whose
normalized URL (fragment stripped, host lowercased, trailing slash
stripped) matches before creating a new one -- if found, the existing item
is returned unchanged instead of creating a duplicate.

This is intentionally simple for v1. `chrome.storage.local` has a default
quota (a few MB), which is generous for text-only bookmarks/notes but not
unlimited.

The "Save current page" button is disabled on pages it can't meaningfully
save (`chrome://`, extension pages, etc.) -- only `http(s)://` pages are
savable.

## Feedback link

The popup footer has a "Feedback" link that opens the extension's feedback
form. The destination is defined by the `FEEDBACK_URL` constant at the top
of `popup.js`, so it can be updated in one place if the form ever moves.

## Limitations

- Duplicate detection is URL-based and only applies to saved pages --
  saving the same selection text twice, or selecting text from a page
  you've already saved, still creates separate items.
- No tags, folders, or organization beyond search.
- No sync between devices/browsers -- data lives in one Chrome profile's
  local storage only.
- Search is a simple case-insensitive substring match, not fuzzy or
  semantic.

## Future possibilities

These are explicitly out of scope for v1, but the architecture (especially
the isolated storage layer) leaves room for them later:

- Cloud sync / a real backend
- Tags or folders for organization
- Sharing saved items
- Semantic/AI-assisted search
- A companion web dashboard
