# Folder Kanban - Obsidian Bases View

A custom view for [Obsidian Bases](https://help.obsidian.md/bases) that turns a folder hierarchy into an interactive kanban board. Subfolders become columns, files become cards, and dragging a card between columns moves the file on disk.

## Demo

<video src="https://github.com/user-attachments/assets/fa75825a-3e8e-4b92-97b9-0216cabde08d" controls width="100%" title="Folder Kanban demo - drag and drop with color themes"></video>

## Features

- **Folder-based columns**: Pick a root folder and each immediate subfolder becomes a kanban column automatically.
- **Drag-and-drop cards**: Move cards between columns to relocate the underlying file into the target subfolder.
- **Column reordering**: Drag columns by their handle to reorder them; your preferred order is saved across sessions.
- **Column color themes**: Assign one of 8 accent colors to any column via a built-in color picker.
- **Remove empty columns**: Click the remove button on an empty column to hide it.
- **Tags and previews**: Optionally display tags and the first ~200 characters of each file on the card.
- **File ignore list**: Exclude files by pattern (e.g. `*.base`, `template.md`) so they don't appear as cards.
- **Click to open**: Click any card to open the note in a reused tab.
- **Unsorted column**: Files sitting directly in the root folder (not in a subfolder) are grouped in a special "Unsorted" column.
- **Responsive design**: Works on desktop and mobile.

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [release](../../releases).
2. Create a folder at `<your vault>/.obsidian/plugins/folder-kanban/`.
3. Place the three files inside it.
4. Reload Obsidian and enable the plugin in **Settings -> Community plugins**.

### Development installation

```bash
git clone https://github.com/outfox/obsidian-bases-kanban.git
cd obsidian-bases-kanban
npm install
npm run build
```

Then copy or symlink the plugin folder into your vault's `.obsidian/plugins/` directory.

## Usage

1. Create or open a Base in Obsidian.
2. Add a view and select **Folder kanban** as the view type.
3. In the view settings, select the **Root folder** whose subfolders you want as columns.
4. Your notes will appear as cards organized by subfolder.
5. Drag cards between columns to move files into different subfolders.
6. Drag columns by their handle to reorder them.
7. Click the color dot on a column header to assign an accent color.
8. Click any card to open the corresponding note.

### View settings

| Setting | Default | Description |
|---|---|---|
| **Root folder** | — | The folder whose subfolders become columns |
| **Show tags** | On | Display tags from file metadata on each card |
| **Show preview** | On | Show first ~200 characters of the file body on each card |
| **Ignored files** | `*.base` | Comma-separated filename patterns to hide from the board (supports `*` wildcards) |
| **Column width** | 280px | Width of each column (180-500px) |

### Example

Given a root folder structure like:

```
Projects/
  To Do/
    research.md
    design.md
  In Progress/
    implementation.md
  Done/
    planning.md
  Projects.base
```

Selecting `Projects` as the root folder produces three columns (**To Do**, **In Progress**, **Done**) with the corresponding files as cards. The `Projects.base` file is hidden by default thanks to the `*.base` ignore pattern.

Dragging `research.md` from **To Do** to **In Progress** moves the file from `Projects/To Do/research.md` to `Projects/In Progress/research.md`.

## Development

### Prerequisites

- Node.js (see `.nvmrc` for version)
- npm

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Watch mode — rebuilds on file changes |
| `npm run build` | Production build (type-check + bundle) |
| `npm run typecheck` | Type-check only |
| `npm test` | Run tests |
| `npm run lint` | Report ESLint violations |
| `npm run lint:fix` | Auto-fix ESLint violations |
| `npm run format` | Format files with Biome |
| `npm run format:check` | Check formatting (CI / pre-commit) |

### Technical notes

- The plugin uses the **`.fbk-`** CSS class prefix (Folder Based Kanban) for all UI classes to avoid collisions with other plugins and themes.
- Drag-and-drop is powered by [SortableJS](https://sortablejs.github.io/Sortable/).
- Rendering is debounced and uses incremental DOM patching for performance.

## Releasing

1. Update `version` in `manifest.json` and `package.json` (must match).
2. Add an entry in `versions.json` mapping the new version to the correct `minAppVersion`.
3. Push to `main`. The GitHub Actions workflow will build, tag, and create a release with `main.js`, `manifest.json`, and `styles.css` as assets.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [SortableJS](https://sortablejs.github.io/Sortable/) for drag-and-drop functionality.
- Designed for the [Obsidian Bases](https://help.obsidian.md/bases) custom views API.
