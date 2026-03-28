import type { BasesEntry, QueryController, ViewOption } from 'obsidian';
import { BasesView, Notice } from 'obsidian';
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
import type { CardData, ColumnData } from './types.ts';
import type { DebouncedFn } from './utils/debounce.ts';
import { debounce } from './utils/debounce.ts';

/**
 * Groups BasesEntry[] by their parent folder relative to rootFolder.
 * Entries whose path starts with rootFolder/<subfolder>/ are grouped by subfolder name.
 * Entries directly in rootFolder go to "Unsorted".
 * Entries outside rootFolder are ignored.
 */
function groupEntriesByFolder(
	entries: BasesEntry[],
	rootFolder: string,
): Map<string, { col: ColumnData; entries: BasesEntry[] }> {
	const groups = new Map<string, { col: ColumnData; entries: BasesEntry[] }>();
	const prefix = rootFolder + '/';

	for (const entry of entries) {
		const path = entry.file.path;
		if (!path.startsWith(prefix)) continue;

		const relative = path.slice(prefix.length);
		const slashIdx = relative.indexOf('/');

		let folderName: string;
		if (slashIdx === -1) {
			// File directly in root folder
			folderName = UNSORTED_LABEL;
		} else {
			folderName = relative.slice(0, slashIdx);
		}

		if (!groups.has(folderName)) {
			const folderPath = folderName === UNSORTED_LABEL ? rootFolder : prefix + folderName;
			groups.set(folderName, {
				col: { folderName, folderPath, cards: [] },
				entries: [],
			});
		}
		// biome-ignore lint: group is guaranteed to exist by the set() above
		const group = groups.get(folderName);
		if (group) {
			group.col.cards.push({ filePath: path, fileName: entry.file.basename });
			group.entries.push(entry);
		}
	}

	return groups;
}

export class FolderKanbanView extends BasesView {
	type = 'folder-kanban-view';

	scrollEl: HTMLElement;
	containerEl: HTMLElement;
	private _columnSortables: Map<string, Sortable> = new Map();
	private columnSortable: Sortable | null = null;
	private _debouncedRender: DebouncedFn<() => void>;
	private activeColorPicker: HTMLElement | null = null;
	private _dragging = false;
	private _activeCardPath: string | null = null;

	private _prefs: {
		columnOrder: string[];
		cardOrders: Record<string, string[]>;
		columnColors: Record<string, string>;
	} = { columnOrder: [], cardOrders: {}, columnColors: {} };

	private _prefsLoaded = false;

	constructor(controller: QueryController, scrollEl: HTMLElement) {
		super(controller);
		this.scrollEl = scrollEl;
		this.containerEl = scrollEl.createDiv({ cls: CSS_CLASSES.VIEW_CONTAINER });

		this._debouncedRender = debounce(() => {
			try {
				this.render();
			} catch (error) {
				console.error('FolderKanbanView error:', error);
			}
		}, DEBOUNCE_DELAY);
	}

	onDataUpdated(): void {
		this._debouncedRender();
	}

	// ── Preferences (persisted via BasesViewConfig) ───────────────

	private _loadPrefs(): void {
		if (this._prefsLoaded) return;
		this._prefsLoaded = true;

		const rawOrders: unknown = this.config?.get('columnOrder');
		if (Array.isArray(rawOrders)) {
			this._prefs.columnOrder = rawOrders.filter((v): v is string => typeof v === 'string');
		}

		const rawCardOrders: unknown = this.config?.get('cardOrders');
		if (rawCardOrders && typeof rawCardOrders === 'object' && !Array.isArray(rawCardOrders)) {
			const result: Record<string, string[]> = {};
			for (const [k, v] of Object.entries(rawCardOrders)) {
				result[k] = Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
			}
			this._prefs.cardOrders = result;
		}

		const rawColors: unknown = this.config?.get('columnColors');
		if (rawColors && typeof rawColors === 'object' && !Array.isArray(rawColors)) {
			const result: Record<string, string> = {};
			for (const [k, v] of Object.entries(rawColors)) {
				if (typeof v === 'string') result[k] = v;
			}
			this._prefs.columnColors = result;
		}
	}

	private _persistPrefs(): void {
		this.config?.set('columnOrder', this._prefs.columnOrder);
		this.config?.set('cardOrders', this._prefs.cardOrders);
		this.config?.set('columnColors', this._prefs.columnColors);
	}

	// ── Rendering ─────────────────────────────────────────────────

	private render(): void {
		try {
			const entries = this.data?.data || [];
			if (!entries || entries.length === 0) {
				this.fullReset();
				this.containerEl.createDiv({
					text: EMPTY_STATE_MESSAGES.NO_ENTRIES,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			const rootFolder = this.getRootFolder();
			if (!rootFolder) {
				this.fullReset();
				this.containerEl.createDiv({
					text: EMPTY_STATE_MESSAGES.NO_ROOT_FOLDER,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			this._loadPrefs();

			const groups = groupEntriesByFolder(entries, rootFolder);

			if (groups.size === 0) {
				this.fullReset();
				this.containerEl.createDiv({
					text: EMPTY_STATE_MESSAGES.NO_SUBFOLDERS,
					cls: CSS_CLASSES.EMPTY_STATE,
				});
				return;
			}

			// Apply saved card order within each column
			for (const [folderName, group] of groups) {
				const savedOrder = this._prefs.cardOrders[folderName];
				if (savedOrder) {
					group.col.cards = this.applyCardOrder(group.col.cards, savedOrder);
				}
			}

			// Filter out empty "Unsorted"
			const displayGroups = new Map([...groups].filter(([name, g]) => name !== UNSORTED_LABEL || g.col.cards.length > 0));

			// Merge newly-seen columns into saved order
			const liveNames = [...displayGroups.keys()].filter((n) => n !== UNSORTED_LABEL);
			const newNames = liveNames.filter((n) => !this._prefs.columnOrder.includes(n));
			if (newNames.length > 0) {
				if (this._prefs.columnOrder.length === 0) {
					this._prefs.columnOrder = [...liveNames].sort();
				} else {
					this._prefs.columnOrder = [...this._prefs.columnOrder, ...newNames];
				}
				this._persistPrefs();
			}

			const orderedNames = this.getOrderedColumnNames(liveNames);
			const orderedColumns: ColumnData[] = orderedNames
				.map((name) => displayGroups.get(name)?.col)
				.filter((c): c is ColumnData => c !== undefined);
			const unsortedGroup = displayGroups.get(UNSORTED_LABEL);
			if (unsortedGroup) orderedColumns.push(unsortedGroup.col);

			const existingBoard = this.containerEl.querySelector<HTMLElement>(`.${CSS_CLASSES.BOARD}`);
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

	private getRootFolder(): string | null {
		const raw = this.config?.get('rootFolder');
		if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
		return null;
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
		this.containerEl.empty();
		this.destroySortables();
	}

	private fullRebuild(columns: ColumnData[]): void {
		this.containerEl.empty();
		this.destroySortables();

		const boardEl = this.containerEl.createDiv({ cls: CSS_CLASSES.BOARD });
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

		existingColumns.forEach((colEl, value) => {
			if (!newNameSet.has(value)) {
				this.detachColumn(value, colEl);
				existingColumns.delete(value);
			}
		});

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

		for (const col of columns) {
			const colEl = existingColumns.get(col.folderName);
			if (colEl) boardEl.appendChild(colEl);
		}
	}

	private patchColumnCards(columnEl: HTMLElement, newCards: CardData[]): void {
		const body = columnEl.querySelector<HTMLElement>(`.${CSS_CLASSES.COLUMN_BODY}`);
		if (!body) return;

		const countEl = columnEl.querySelector(`.${CSS_CLASSES.COLUMN_COUNT}`);
		if (countEl) countEl.textContent = `(${newCards.length})`;

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

		const newPaths = new Set(newCards.map((c) => c.filePath));
		body.querySelectorAll(`.${CSS_CLASSES.CARD}`).forEach((card) => {
			if (card instanceof HTMLElement) {
				const path = card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
				if (path && !newPaths.has(path)) card.remove();
			}
		});

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

		const colorName = this._prefs.columnColors[col.folderName] ?? null;
		this.applyColumnColor(columnEl, colorName);

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

		if (col.cards.length === 0 && !isUnsorted) {
			headerEl.appendChild(this.createRemoveButton(col.folderName, columnEl));
		}

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

		cardEl.addEventListener('mouseenter', () => cardEl.classList.add(CSS_CLASSES.CARD_HOVER));
		cardEl.addEventListener('mouseleave', () => cardEl.classList.remove(CSS_CLASSES.CARD_HOVER));

		cardEl.addEventListener('click', (e: MouseEvent) => {
			if (e.target instanceof Element && e.target.closest('a')) return;
			this.setActiveCard(card.filePath);
			if (this.app?.workspace) {
				void this.app.workspace.openLinkText(card.filePath, '', false);
			}
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
			delete this._prefs.columnColors[columnValue];
			this._persistPrefs();
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
				this._prefs.columnColors[columnValue] = color.name;
				this._persistPrefs();
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
		this._prefs.columnOrder = this._prefs.columnOrder.filter((v) => v !== value);
		this._persistPrefs();
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
		this.containerEl.querySelectorAll(selector).forEach((columnBody) => {
			if (!(columnBody instanceof HTMLElement)) return;
			const colEl = columnBody.closest(`.${CSS_CLASSES.COLUMN}`);
			const value = colEl instanceof HTMLElement ? colEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) : null;
			if (!value) return;
			this.attachCardSortable(columnBody, value);
		});
	}

	private initializeColumnSortable(): void {
		if (this.columnSortable) this.columnSortable.destroy();

		const boardEl = this.containerEl.querySelector(`.${CSS_CLASSES.BOARD}`);
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
			this._prefs.cardOrders[newColumnValue] = getColumnPaths(evt.to);
			this._persistPrefs();
			return;
		}

		// Cross-column: save card orders for both columns
		if (oldColumnEl instanceof HTMLElement && oldColumnValue) {
			const oldBody = oldColumnEl.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`);
			if (oldBody) this._prefs.cardOrders[oldColumnValue] = getColumnPaths(oldBody);
		}
		this._prefs.cardOrders[newColumnValue] = getColumnPaths(evt.to);
		this._persistPrefs();

		// Move the file
		const rootFolder = this.getRootFolder();
		if (!rootFolder) return;

		const file = this.app?.vault.getAbstractFileByPath(entryPath);
		if (!file || !('extension' in file)) {
			console.warn('File not found:', entryPath);
			this.render();
			return;
		}

		const fileName = file.name;
		const targetFolder = newColumnValue === UNSORTED_LABEL ? rootFolder : rootFolder + '/' + newColumnValue;
		const newPath = targetFolder + '/' + fileName;

		if (this.app?.vault.getAbstractFileByPath(newPath)) {
			new Notice(`A file named "${fileName}" already exists in "${newColumnValue}".`);
			this.render();
			return;
		}

		try {
			await this.app?.vault.rename(file, newPath);
		} catch (error) {
			console.error('Error moving file:', error);
			new Notice(`Failed to move "${fileName}".`);
			this.render();
		}
	}

	private handleColumnDrop(_evt: Sortable.SortableEvent): void {
		const columns = this.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const order = Array.from(columns)
			.map((col) => col.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE))
			.filter((v): v is string => v !== null && v !== UNSORTED_LABEL);

		this._prefs.columnOrder = order;
		this._persistPrefs();
	}

	// ── Helpers ────────────────────────────────────────────────────

	private getOrderedColumnNames(liveNames: string[]): string[] {
		if (!this._prefs.columnOrder.length) return liveNames.sort();
		const newNames = liveNames.filter((n) => !this._prefs.columnOrder.includes(n));
		return [...this._prefs.columnOrder, ...newNames];
	}

	private applyCardOrder(cards: CardData[], savedOrder: string[]): CardData[] {
		const cardMap = new Map(cards.map((c) => [c.filePath, c]));
		const ordered = savedOrder.map((p) => cardMap.get(p)).filter((c): c is CardData => c !== undefined);
		const unsaved = cards.filter((c) => !savedOrder.includes(c.filePath));
		return [...ordered, ...unsaved];
	}

	private findCardEl(path: string): HTMLElement | null {
		return (
			Array.from(this.containerEl.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.CARD}`)).find(
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

	onClose(): void {
		this._debouncedRender.cancel();
		this.destroySortables();
		this.activeColorPicker?.remove();
		this.activeColorPicker = null;
	}

	static getViewOptions(this: void): ViewOption[] {
		return [
			{
				displayName: 'Root folder',
				type: 'folder',
				key: 'rootFolder',
				placeholder: 'Select folder',
			},
		];
	}
}
