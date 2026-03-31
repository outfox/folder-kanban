## Folder Kanban - Obsidian Bases view plugin

A custom [Obsidian Bases](https://help.obsidian.md/bases) view that turns a folder hierarchy into an interactive kanban board. Subfolders of a chosen root become columns; files within those subfolders become draggable cards. Dragging a card across columns moves the underlying file into the target subfolder.

### How it works

1. The user picks a **root folder** in the view settings.
2. Each immediate subfolder of that root becomes a **column**.
3. Files inside each subfolder become **cards** displayed in that column.
4. Files sitting directly in the root (not in a subfolder) appear in a special **Unsorted** column.
5. Dragging a card to another column calls `vault.rename()` to move the file into the corresponding subfolder.
6. Column order, card order, and column colors are persisted via `this.config` (Bases view config).

### View settings (defined in `getViewOptions()`)

| Setting | Type | Default | Description |
|---|---|---|---|
| Root folder | folder picker | — | The folder whose subfolders become columns |
| Show tags | toggle | `true` | Display tags extracted from file metadata on cards |
| Show preview | toggle | `true` | Show the first ~200 characters of file body on cards |
| Ignored files (comma-separated) | text | `*.base` | Comma-separated filename patterns (with `*` glob) to exclude from the board |
| Column width | slider | 280 | Column width in pixels (180–500) |

### Key features

- **Drag-and-drop cards** between columns (moves files on disk via `vault.rename()`).
- **Drag-and-drop columns** to reorder (persisted across sessions).
- **Column color themes** via a color picker (8 Obsidian palette colors).
- **Remove empty columns** with the `x` button on the column header.
- **File ignore list** with glob pattern matching to hide files like `.base` definitions.
- **Click cards** to open the note in a reused tab.
- **Debounced rendering** (50ms) to handle rapid vault events efficiently.
- **Incremental DOM patching** — after the initial render, subsequent updates surgically patch the DOM rather than rebuilding.

## Project overview

- Target: Obsidian Community Plugin (TypeScript bundled to JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and `styles.css`.
- **CSS class prefix**: `.fbk-` (Folder Based Kanban). All class names are defined in `src/constants.ts` (`CSS_CLASSES`).

## File structure

```
src/
  main.ts           # Plugin entry point — registers the Bases view (minimal)
  kanbanView.ts     # FolderKanbanView class — rendering, drag-drop, settings, color picker
  types.ts          # CardData, ColumnData interfaces
  constants.ts      # CSS classes, color palette, sortable config, empty-state messages
  utils/
    debounce.ts     # Debounce utility
```

## Environment & tooling

- Node.js version managed via `.nvmrc`; run `nvm use` to activate.
- **Package manager**: npm.
- **Bundler**: esbuild (`esbuild.config.mjs`).
- **Types**: `obsidian` type definitions.
- **Drag-and-drop**: SortableJS (`sortablejs` v1.15).

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Tests

```bash
npm test
```

## Linting and formatting

ESLint handles linting; [Biome](https://biomejs.dev/) handles formatting. Both are devDependencies.

| Script | Purpose |
|---|---|
| `npm run lint` | Report ESLint rule violations |
| `npm run lint:fix` | Auto-fix ESLint violations |
| `npm run format` | Rewrite files with Biome |
| `npm run format:check` | Exit non-zero if any file is unformatted (used by CI and pre-commit hook) |

A pre-commit hook (`.githooks/pre-commit`) runs `format:check` then `lint` automatically after `npm install` via the `prepare` script.

## Coding conventions

- TypeScript with `"strict": true`.
- **Keep `main.ts` minimal**: only plugin lifecycle. All view logic lives in `kanbanView.ts`.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Prefer `async/await` over promise chains.
- Use the `.fbk-` CSS class prefix for all UI classes.
- `isDesktopOnly` is `false` — avoid desktop-only APIs.

## Manifest rules (`manifest.json`)

- Must include: `id`, `name`, `version` (SemVer), `minAppVersion`, `description`, `isDesktopOnly`.
- Never change `id` after release.
- Keep `minAppVersion` accurate when using newer APIs.

## Testing

- Manual install: copy `main.js`, `manifest.json`, `styles.css` to `<Vault>/.obsidian/plugins/folder-kanban/`.
- Reload Obsidian and enable in **Settings -> Community plugins**.

## Versioning & releases

- Bump `version` in both `manifest.json` and `package.json` (SemVer).
- Update `versions.json` to map plugin version to minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json` version (no `v` prefix).
- Attach `manifest.json`, `main.js`, and `styles.css` to the release.

## Security & privacy

- Fully local/offline — no network requests.
- No telemetry.
- Only reads/writes files within the vault.
- All DOM and event listeners are cleaned up in `onClose()`.

## Performance

- Startup is lightweight — the view only renders when data arrives from the Bases query controller.
- Rendering is debounced at 50ms.
- After initial render, the DOM is patched incrementally (add/remove/reorder) rather than rebuilt.
- File content for previews is loaded via `vault.cachedRead()` (async, batched).

## Agent do/don't

**Do**
- Keep `main.ts` minimal (lifecycle only).
- Use the `CSS_CLASSES` constants from `constants.ts` for all class names.
- Register and clean up all listeners.
- Provide sensible defaults for all settings.

**Don't**
- Add network calls without clear justification.
- Commit build artifacts (`main.js`, `node_modules/`).
- Use desktop-only APIs (plugin supports mobile).
- Add large dependencies.

## References

- Obsidian API: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian style guide: https://help.obsidian.md/style-guide
