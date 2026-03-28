import { ItemView, Notice, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import Sortable from 'sortablejs';
import {
	COLOR_PALETTE,
	CSS_CLASSES,
	DATA_ATTRIBUTES,
	DEBOUNCE_DELAY,
	EMPTY_STATE_MESSAGES,
	SORTABLE_CONFIG,
	SORTABLE_GROUP,
	UNSORTED_LABEL,
} from './constants.ts';
import { scanRootFolder } from './folderScanner.ts';
import type FolderKanbanPlugin from './main.ts';
import { VIEW_TYPE_FOLDER_KANBAN } from './main.ts';
import type { CardData, ColumnData } from './types.ts';
import type { DebouncedFn } from './utils/debounce.ts';
import { debounce } from './utils/debounce.ts';

export class FolderKanbanView extends ItemView {
	plugin: FolderKanbanPlugin;
	private _columnSortables: Map<string, Sortable> = new Map();
	private columnSortable: Sortable | null = null;
	private _debouncedRefresh: DebouncedFn<() => void>;
	private activeColorPicker: HTMLElement | null = null;
	private _dragging = false;
	private _activeCardPath: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FolderKanbanPlugin) {
		super(leaf);
		this.plugin = plugin;
		this._debouncedRefresh = debounce(() => {
			try {
				this.render();
			} catch (error) {
				console.error('FolderKanbanView error:', error);
			}
		}, DEBOUNCE_DELAY);
	}

	getViewType(): string {
		return VIEW_TYPE_FOLDER_KANBAN;
	}

	getDisplayText(): string {
		return 'Folder kanban';
	}

	getIcon(): string {
		return 'columns-3';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass(CSS_CLASSES.VIEW_CONTAINER);
		this.registerVaultEvents();
		this.render();
	}

	async onClose(): Promise<void> {
		this._debouncedRefresh.cancel();
		this.destroySortables();
		this.activeColorPicker?.remove();
		this.activeColorPicker = null;
	}

	/** Called by the plugin when settings change or vault events fire. */
	refresh(): void {
		this._debouncedRefresh();
	}

	// ── Vault events ──────────────────────────────────────────────

	private registerVaultEvents(): void {
		const relevant = (path: string) => {
			const root = this.plugin.state.settings.rootFolder;
			return root !== '' && (path === root || path.startsWith(root + '/'));
		};

		this.registerEvent(
			this.app.vault.on('create', (file: TAbstractFile) => {
				if (relevant(file.path)) this._debouncedRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file: TAbstractFile) => {
				if (relevant(file.path)) this._debouncedRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
				if (relevant(file.path) || relevant(oldPath)) this._debouncedRefresh();
			}),
		);
	}

	// ── Rendering ─────────────────────────────────────────────────

	private render(): void {
		try {
			const rootFolder = this.plugin.state.settings.rootFolder;
			if (!rootFolder) {
				this.fullReset();
				this.contentEl.createDiv({
					text: EMPTY_STATE_MESSAGES.NO_ROOT_FOLDER,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			const columns = scanRootFolder(this.app.vault, rootFolder);

			// Check if root folder exists
			const rootExists = this.app.vault.getAbstractFileByPath(rootFolder);
			if (!rootExists) {
				this.fullReset();
				this.contentEl.createDiv({
					text: EMPTY_STATE_MESSAGES.ROOT_NOT_FOUND,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			// Filter out empty "Unsorted" for display; keep non-Unsorted columns even if empty
			const displayColumns = columns.filter((c) => c.folderName !== UNSORTED_LABEL || c.cards.length > 0);

			if (displayColumns.length === 0) {
				this.fullReset();
				this.contentEl.createDiv({
					text: EMPTY_STATE_MESSAGES.NO_SUBFOLDERS,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			// Apply saved card order within each column
			for (const col of displayColumns) {
				const savedOrder = this.plugin.state.cardOrders[col.folderName];
				if (savedOrder) {
					col.cards = this.applyCardOrder(col.cards, savedOrder);
				}
			}

			// Merge newly-seen columns into saved order
			const liveNames = displayColumns.map((c) => c.folderName).filter((n) => n !== UNSORTED_LABEL);
			const newNames = liveNames.filter((n) => !this.plugin.state.columnOrder.includes(n));
			if (newNames.length > 0) {
				if (this.plugin.state.columnOrder.length === 0) {
					this.plugin.state.columnOrder = [...liveNames].sort();
				} else {
					this.plugin.state.columnOrder = [...this.plugin.state.columnOrder, ...newNames];
				}
				void this.plugin.saveSettings();
			}

			const orderedNames = this.getOrderedColumnNames(liveNames);
			// Build ordered ColumnData array; "Unsorted" always goes last
			const columnMap = new Map(displayColumns.map((c) => [c.folderName, c]));
			const orderedColumns: ColumnData[] = orderedNames
				.map((name) => columnMap.get(name))
				.filter((c): c is ColumnData => c !== undefined);
			const unsortedCol = columnMap.get(UNSORTED_LABEL);
			if (unsortedCol) orderedColumns.push(unsortedCol);

			const existingBoard = this.contentEl.querySelector<HTMLElement>(`.${CSS_CLASSES.BOARD}`);
			if (!existingBoard) {
				this.fullRebuild(orderedColumns);
			} else {
				this.patchBoard(existingBoard, orderedColumns);
			}
			this.reapplyActiveCard();
		} catch (error) {
			console.error('FolderKanbanView error:', error);
		}
	}

	private destroySortables(): void {
		this._columnSortables.forEach((s) => s.destroy());
		this._columnSortables.clear();
		if (this.columnSortable) {
			this.columnSortable.destroy();
			this.columnSortable = null;
		}
	}

	private fullReset(): void {
		this.contentEl.empty();
		this.destroySortables();
	}

	private fullRebuild(columns: ColumnData[]): void {
		this.contentEl.empty();
		this.destroySortables();

		const boardEl = this.contentEl.createDiv({ cls: CSS_CLASSES.BOARD });
		for (const col of columns) {
			boardEl.appendChild(this.createColumn(col));
		}

		this.initializeSortable();
		this.initializeColumnSortable();
	}

	private patchBoard(boardEl: HTMLElement, columns: ColumnData[]): void {
		const existingColumns = new Map<string, HTMLElement>();
		boardEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`).forEach((col) => {
			if (col instanceof HTMLElement) {
				const val = col.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE);
				if (val !== null) existingColumns.set(val, col);
			}
		});

		const newNameSet = new Set(columns.map((c) => c.folderName));

		// Remove columns no longer present
		existingColumns.forEach((colEl, value) => {
			if (!newNameSet.has(value)) {
				this.detachColumn(value, colEl);
				existingColumns.delete(value);
			}
		});

		// Add new columns; patch cards in existing ones
		for (const col of columns) {
			if (!existingColumns.has(col.folderName)) {
				const columnEl = this.createColumn(col);
				boardEl.appendChild(columnEl);
				existingColumns.set(col.folderName, columnEl);
				const body = columnEl.querySelector(`.${CSS_CLASSES.COLUMN_BODY}[${DATA_ATTRIBUTES.SORTABLE_CONTAINER}]`);
				if (body instanceof HTMLElement) {
					this.attachCardSortable(body, col.folderName);
				}
			} else {
				const colEl = existingColumns.get(col.folderName);
				if (colEl) this.patchColumnCards(colEl, col.cards);
			}
		}

		// Re-order columns in DOM
		for (const col of columns) {
			const colEl = existingColumns.get(col.folderName);
			if (colEl) boardEl.appendChild(colEl);
		}
	}

	private patchColumnCards(columnEl: HTMLElement, newCards: CardData[]): void {
		const body = columnEl.querySelector<HTMLElement>(`.${CSS_CLASSES.COLUMN_BODY}`);
		if (!body) return;

		// Update column count
		const countEl = columnEl.querySelector(`.${CSS_CLASSES.COLUMN_COUNT}`);
		if (countEl) countEl.textContent = `(${newCards.length})`;

		// Sync remove button
		const headerEl = columnEl.querySelector<HTMLElement>(`.${CSS_CLASSES.COLUMN_HEADER}`);
		if (headerEl) {
			const columnValue = columnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE);
			const existingRemoveBtn = headerEl.querySelector(`.${CSS_CLASSES.COLUMN_REMOVE_BTN}`);
			if (newCards.length === 0 && !existingRemoveBtn && columnValue && columnValue !== UNSORTED_LABEL) {
				headerEl.appendChild(this.createRemoveButton(columnValue, columnEl));
			} else if (newCards.length > 0 && existingRemoveBtn) {
				existingRemoveBtn.remove();
			}
		}

		// Remove cards not in new set
		const newPaths = new Set(newCards.map((c) => c.filePath));
		body.querySelectorAll(`.${CSS_CLASSES.CARD}`).forEach((card) => {
			if (card instanceof HTMLElement) {
				const path = card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
				if (path && !newPaths.has(path)) card.remove();
			}
		});

		// Add missing cards
		const existingPaths = new Set<string>();
		body.querySelectorAll(`.${CSS_CLASSES.CARD}`).forEach((card) => {
			if (card instanceof HTMLElement) {
				const path = card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
				if (path) existingPaths.add(path);
			}
		});
		for (const card of newCards) {
			if (!existingPaths.has(card.filePath)) {
				body.appendChild(this.createCard(card));
			}
		}

		// Reorder cards (skip during drags)
		if (!this._dragging) {
			const pathToCard = new Map<string, Element>();
			body.querySelectorAll(`.${CSS_CLASSES.CARD}`).forEach((card) => {
				const path = card instanceof HTMLElement ? card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH) : null;
				if (path) pathToCard.set(path, card);
			});
			for (const card of newCards) {
				const el = pathToCard.get(card.filePath);
				if (el) body.appendChild(el);
			}
		}
	}

	// ── Column & Card creation ────────────────────────────────────

	private createColumn(col: ColumnData): HTMLElement {
		const isUnsorted = col.folderName === UNSORTED_LABEL;
		const columnEl = document.createElement('div');
		columnEl.className = CSS_CLASSES.COLUMN;
		columnEl.setAttribute(DATA_ATTRIBUTES.COLUMN_VALUE, col.folderName);

		// Apply stored color accent
		const colorName = this.plugin.state.columnColors[col.folderName] ?? null;
		this.applyColumnColor(columnEl, colorName);

		// Header
		const headerEl = columnEl.createDiv({ cls: CSS_CLASSES.COLUMN_HEADER });

		if (!isUnsorted) {
			const dragHandle = headerEl.createDiv({ cls: CSS_CLASSES.COLUMN_DRAG_HANDLE });
			dragHandle.textContent = '\u22EE\u22EE';
		}

		const colorBtn = headerEl.createDiv({ cls: CSS_CLASSES.COLUMN_COLOR_BTN });
		colorBtn.setAttribute('aria-label', `Set color for column: ${col.folderName}`);
		colorBtn.setAttribute('role', 'button');
		colorBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openColorPicker(colorBtn, columnEl, col.folderName);
		});

		headerEl.createSpan({ text: col.folderName, cls: CSS_CLASSES.COLUMN_TITLE });
		headerEl.createSpan({ text: `(${col.cards.length})`, cls: CSS_CLASSES.COLUMN_COUNT });

		// Remove button — only for non-Unsorted empty columns
		if (col.cards.length === 0 && !isUnsorted) {
			headerEl.appendChild(this.createRemoveButton(col.folderName, columnEl));
		}

		// Body
		const bodyEl = columnEl.createDiv({ cls: CSS_CLASSES.COLUMN_BODY });
		bodyEl.setAttribute(DATA_ATTRIBUTES.SORTABLE_CONTAINER, 'true');

		for (const card of col.cards) {
			bodyEl.appendChild(this.createCard(card));
		}

		return columnEl;
	}

	private createCard(card: CardData): HTMLElement {
		const cardEl = document.createElement('div');
		cardEl.className = CSS_CLASSES.CARD;
		cardEl.setAttribute(DATA_ATTRIBUTES.ENTRY_PATH, card.filePath);

		const titleEl = cardEl.createDiv({ cls: CSS_CLASSES.CARD_TITLE });
		titleEl.textContent = card.fileName;

		// JS-managed hover
		cardEl.addEventListener('mouseenter', () => cardEl.classList.add(CSS_CLASSES.CARD_HOVER));
		cardEl.addEventListener('mouseleave', () => cardEl.classList.remove(CSS_CLASSES.CARD_HOVER));

		cardEl.addEventListener('click', (e: MouseEvent) => {
			if (e.target instanceof Element && e.target.closest('a')) return;
			this.setActiveCard(card.filePath);
			void this.app.workspace.openLinkText(card.filePath, '', false);
		});

		return cardEl;
	}

	// ── Column color ──────────────────────────────────────────────

	private applyColumnColor(columnEl: HTMLElement, colorName: string | null): void {
		if (colorName) {
			const cssVar = COLOR_PALETTE.find((c) => c.name === colorName)?.cssVar ?? null;
			if (cssVar) {
				columnEl.style.setProperty('--fbk-column-accent-color', cssVar);
				columnEl.setAttribute(DATA_ATTRIBUTES.COLUMN_COLOR, colorName);
				return;
			}
		}
		columnEl.style.removeProperty('--fbk-column-accent-color');
		columnEl.removeAttribute(DATA_ATTRIBUTES.COLUMN_COLOR);
	}

	private openColorPicker(anchorEl: HTMLElement, columnEl: HTMLElement, columnValue: string): void {
		this.activeColorPicker?.remove();
		this.activeColorPicker = null;

		const popover = document.createElement('div');
		popover.className = CSS_CLASSES.COLUMN_COLOR_POPOVER;

		const currentColor = columnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_COLOR);

		const noneSwatch = document.createElement('div');
		noneSwatch.className = `${CSS_CLASSES.COLUMN_COLOR_SWATCH} ${CSS_CLASSES.COLUMN_COLOR_NONE}`;
		if (!currentColor) noneSwatch.classList.add(CSS_CLASSES.COLUMN_COLOR_SWATCH_ACTIVE);
		noneSwatch.title = 'No color';
		noneSwatch.addEventListener('click', () => {
			this.applyColumnColor(columnEl, null);
			delete this.plugin.state.columnColors[columnValue];
			void this.plugin.saveSettings();
			popover.remove();
			this.activeColorPicker = null;
		});
		popover.appendChild(noneSwatch);

		for (const color of COLOR_PALETTE) {
			const swatch = document.createElement('div');
			swatch.className = CSS_CLASSES.COLUMN_COLOR_SWATCH;
			swatch.style.background = color.cssVar;
			swatch.title = color.name;
			if (currentColor === color.name) swatch.classList.add(CSS_CLASSES.COLUMN_COLOR_SWATCH_ACTIVE);
			swatch.addEventListener('click', () => {
				this.applyColumnColor(columnEl, color.name);
				this.plugin.state.columnColors[columnValue] = color.name;
				void this.plugin.saveSettings();
				popover.remove();
				this.activeColorPicker = null;
			});
			popover.appendChild(swatch);
		}

		const rect = anchorEl.getBoundingClientRect();
		popover.style.top = `${rect.bottom + 4}px`;
		popover.style.left = `${rect.left}px`;
		document.body.appendChild(popover);
		this.activeColorPicker = popover;

		const dismiss = (e: MouseEvent) => {
			if (e.target instanceof Node && !popover.contains(e.target) && e.target !== anchorEl) {
				popover.remove();
				this.activeColorPicker = null;
				document.removeEventListener('click', dismiss);
			}
		};
		document.addEventListener('click', dismiss);
	}

	// ── Column management ─────────────────────────────────────────

	private createRemoveButton(value: string, columnEl: HTMLElement): HTMLElement {
		const btn = document.createElement('div');
		btn.className = CSS_CLASSES.COLUMN_REMOVE_BTN;
		btn.setAttribute('aria-label', `Remove column: ${value}`);
		btn.setAttribute('role', 'button');
		btn.textContent = '\u00D7';
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.removeColumn(value, columnEl);
		});
		return btn;
	}

	private detachColumn(value: string, colEl: HTMLElement): void {
		const sortable = this._columnSortables.get(value);
		if (sortable) {
			sortable.destroy();
			this._columnSortables.delete(value);
		}
		colEl.remove();
	}

	private removeColumn(value: string, columnEl: HTMLElement): void {
		this.plugin.state.columnOrder = this.plugin.state.columnOrder.filter((v) => v !== value);
		void this.plugin.saveSettings();
		this.detachColumn(value, columnEl);
	}

	// ── Sortable setup ────────────────────────────────────────────

	private attachCardSortable(body: HTMLElement, folderName: string): void {
		const sortable = new Sortable(body, {
			group: SORTABLE_GROUP,
			animation: SORTABLE_CONFIG.ANIMATION_DURATION,
			dragClass: CSS_CLASSES.CARD_DRAGGING,
			ghostClass: CSS_CLASSES.CARD_GHOST,
			chosenClass: CSS_CLASSES.CARD_CHOSEN,
			onStart: (evt: Sortable.SortableEvent) => {
				this._dragging = true;
				if (evt.item instanceof HTMLElement) evt.item.classList.remove(CSS_CLASSES.CARD_HOVER);
			},
			onEnd: (evt: Sortable.SortableEvent) => {
				this._dragging = false;
				this.setActiveCard(null);
				void this.handleCardDrop(evt);
			},
		});
		this._columnSortables.set(folderName, sortable);
	}

	private initializeSortable(): void {
		const selector = `.${CSS_CLASSES.COLUMN_BODY}[${DATA_ATTRIBUTES.SORTABLE_CONTAINER}]`;
		this.contentEl.querySelectorAll(selector).forEach((columnBody) => {
			if (!(columnBody instanceof HTMLElement)) return;
			const colEl = columnBody.closest(`.${CSS_CLASSES.COLUMN}`);
			const value = colEl instanceof HTMLElement ? colEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) : null;
			if (!value) return;
			this.attachCardSortable(columnBody, value);
		});
	}

	private initializeColumnSortable(): void {
		if (this.columnSortable) this.columnSortable.destroy();

		const boardEl = this.contentEl.querySelector(`.${CSS_CLASSES.BOARD}`);
		if (!boardEl || !(boardEl instanceof HTMLElement)) return;

		this.columnSortable = new Sortable(boardEl, {
			animation: SORTABLE_CONFIG.ANIMATION_DURATION,
			handle: `.${CSS_CLASSES.COLUMN_DRAG_HANDLE}`,
			draggable: `.${CSS_CLASSES.COLUMN}`,
			ghostClass: CSS_CLASSES.COLUMN_GHOST,
			dragClass: CSS_CLASSES.COLUMN_DRAGGING,
			filter: `[${DATA_ATTRIBUTES.COLUMN_VALUE}="${UNSORTED_LABEL}"]`,
			onStart: () => {
				this._dragging = true;
			},
			onEnd: (evt: Sortable.SortableEvent) => {
				this._dragging = false;
				this.handleColumnDrop(evt);
			},
		});
	}

	// ── Drag-drop handlers ────────────────────────────────────────

	private async handleCardDrop(evt: Sortable.SortableEvent): Promise<void> {
		if (!(evt.item instanceof HTMLElement)) return;

		const cardEl = evt.item;
		const entryPath = cardEl.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
		if (!entryPath) return;

		const columnSelector = `.${CSS_CLASSES.COLUMN}`;
		const oldColumnEl = evt.from.closest(columnSelector);
		const newColumnEl = evt.to.closest(columnSelector);

		if (!newColumnEl || !(newColumnEl instanceof HTMLElement)) return;

		const oldColumnValue =
			oldColumnEl instanceof HTMLElement ? oldColumnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) : null;
		const newColumnValue = newColumnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE);
		if (!newColumnValue) return;

		const getColumnPaths = (bodyEl: Element): string[] =>
			Array.from(bodyEl.querySelectorAll(`.${CSS_CLASSES.CARD}`))
				.map((c) => (c instanceof HTMLElement ? c.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH) : null))
				.filter((p): p is string => p !== null);

		// Same-column reorder
		if (oldColumnValue === newColumnValue) {
			this.plugin.state.cardOrders[newColumnValue] = getColumnPaths(evt.to);
			void this.plugin.saveSettings();
			return;
		}

		// Cross-column: save card orders for both columns
		if (oldColumnEl instanceof HTMLElement && oldColumnValue) {
			const oldBody = oldColumnEl.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`);
			if (oldBody) this.plugin.state.cardOrders[oldColumnValue] = getColumnPaths(oldBody);
		}
		this.plugin.state.cardOrders[newColumnValue] = getColumnPaths(evt.to);
		void this.plugin.saveSettings();

		// Move the file
		const file = this.app.vault.getAbstractFileByPath(entryPath);
		if (!file || !('extension' in file)) {
			console.warn('File not found:', entryPath);
			this.render();
			return;
		}

		const rootFolder = this.plugin.state.settings.rootFolder;
		const fileName = file.name;
		const targetFolder = newColumnValue === UNSORTED_LABEL ? rootFolder : rootFolder + '/' + newColumnValue;
		const newPath = targetFolder + '/' + fileName;

		// Check for name collision
		if (this.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`A file named "${fileName}" already exists in "${newColumnValue}".`);
			this.render(); // Revert DOM to actual state
			return;
		}

		try {
			await this.app.vault.rename(file, newPath);
		} catch (error) {
			console.error('Error moving file:', error);
			new Notice(`Failed to move "${fileName}".`);
			this.render();
		}
	}

	private handleColumnDrop(evt: Sortable.SortableEvent): void {
		const columns = this.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const order = Array.from(columns)
			.map((col) => col.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE))
			.filter((v): v is string => v !== null && v !== UNSORTED_LABEL);

		this.plugin.state.columnOrder = order;
		void this.plugin.saveSettings();
	}

	// ── Helpers ────────────────────────────────────────────────────

	private getOrderedColumnNames(liveNames: string[]): string[] {
		if (!this.plugin.state.columnOrder.length) return liveNames.sort();
		const newNames = liveNames.filter((n) => !this.plugin.state.columnOrder.includes(n));
		return [...this.plugin.state.columnOrder, ...newNames];
	}

	private applyCardOrder(cards: CardData[], savedOrder: string[]): CardData[] {
		const cardMap = new Map(cards.map((c) => [c.filePath, c]));
		const ordered = savedOrder.map((p) => cardMap.get(p)).filter((c): c is CardData => c !== undefined);
		const unsaved = cards.filter((c) => !savedOrder.includes(c.filePath));
		return [...ordered, ...unsaved];
	}

	private findCardEl(path: string): HTMLElement | null {
		return (
			Array.from(this.contentEl.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.CARD}`)).find(
				(el) => el.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH) === path,
			) ?? null
		);
	}

	private setActiveCard(path: string | null): void {
		if (this._activeCardPath) {
			this.findCardEl(this._activeCardPath)?.classList.remove(CSS_CLASSES.CARD_ACTIVE);
		}
		this._activeCardPath = path;
		if (path) {
			this.findCardEl(path)?.classList.add(CSS_CLASSES.CARD_ACTIVE);
		}
	}

	private reapplyActiveCard(): void {
		if (!this._activeCardPath) return;
		this.findCardEl(this._activeCardPath)?.classList.add(CSS_CLASSES.CARD_ACTIVE);
	}
}
