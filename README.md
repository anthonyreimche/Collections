# Collections

Collections and smart collections for SafeLight — virtual photo groupings independent of folder structure. Gather your best work into named collections, or let rule-based smart collections assemble themselves from ratings, flags, keywords, capture dates, camera gear and more, updating live as your library changes.

Your photos never move and nothing is written into them: a collection is a lightweight list the extension keeps for you, so membership composes cleanly with folders, filters, and every other tool.

## The Collections panel

Docked on the left side of the Library between Folders and Filters (View menu ▸ Collections if you've closed it).

- **Click a collection** to show its photos in the grid, wherever they live on disk (the folder source switches to All Photos, like Lightroom). Click again — or pick a folder, or Clear filters — to go back.
- **Counts** — each row shows how many of its photos are in the open project. A `*` means some members live in other project folders (hover for the split); they're safe, just not visible here.
- **Create** — the two ＋ buttons at the bottom make a collection or a smart collection. Double-click any row to rename; right-click for Rename, Duplicate, Set as target collection, Edit rules…, and Delete.
- **Drag and drop** — drag photos from the grid onto a collection row to add them.
- **Other projects** — collections whose photos all belong to other project folders are hidden by default; the footer link reveals them.

## Adding photos

- **Right-click ▸ Add to collection…** opens a chooser with membership checkboxes for the selected photos (checked = all in, dash = some), plus an inline "New collection" row. Changes apply immediately.
- **B — the target collection.** Press `B` to toggle the selection in your target collection, marked with a `+` badge in the panel (right-click a collection ▸ *Set as target collection*). The first press with no target creates a "Quick Collection" for you. A toast confirms each add/remove, so it works with the panel closed.
- **Remove** — while browsing a collection, right-click ▸ *Remove from "‹name›"*; or untick it in the chooser.
- Removing a photo from the catalogue removes it from every collection automatically.

## Smart collections

A smart collection is a saved query: photos match its rules live, nothing is stored per photo. The editor previews the match count as you type.

- **Match all / any** of the rules.
- **Fields** — rating, flag, colour label, keyword, filename, folder, file type (including a `RAW` group), capture and import dates (last N days, before/after, between), camera, lens, ISO, focal length, aperture, shutter speed, orientation, GPS presence, and virtual copies.
- Rules written by a newer version of the extension are kept and shown as unsupported rather than discarded, so files round-trip safely between versions.

## Development

```
npm install
npm run build          # bundle → index.js
npm run install-local  # build + copy into SafeLight's plugins dir
npm test               # model + store unit tests (rules, list ops, sanitize, activation)
npm run smoke          # build + mocked-API smoke test
npm run typecheck
```

Single-file ESM bundle, classic-JSX against the app's React (`api.react`), inline styles over `api.ui` primitives and tokens. Collections persist via extension settings and sync across windows; membership references photo ids, which are unique per photo, so a collection can never pick up another project's images. The grid integration is one `registerGridFilter` predicate — core stays blind to why photos are shown.

## Licence

MIT
