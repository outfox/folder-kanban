/**
 * Constants used throughout the Folder Kanban view
 */

/** Label for the special column containing files directly in the root folder */
export const UNSORTED_LABEL = 'Unsorted';

/** Color palette for column accents, using Obsidian design system variables */
export const COLOR_PALETTE = [
	{ name: 'red', cssVar: 'var(--color-red)' },
	{ name: 'orange', cssVar: 'var(--color-orange)' },
	{ name: 'yellow', cssVar: 'var(--color-yellow)' },
	{ name: 'green', cssVar: 'var(--color-green)' },
	{ name: 'cyan', cssVar: 'var(--color-cyan)' },
	{ name: 'blue', cssVar: 'var(--color-blue)' },
	{ name: 'purple', cssVar: 'var(--color-purple)' },
	{ name: 'pink', cssVar: 'var(--color-pink)' },
] as const;

export type ColorName = (typeof COLOR_PALETTE)[number]['name'];

/** Sortable.js group name for kanban columns */
export const SORTABLE_GROUP = 'fbk-columns';

/** Data attribute names */
export const DATA_ATTRIBUTES = {
	COLUMN_VALUE: 'data-column-value',
	ENTRY_PATH: 'data-entry-path',
	SORTABLE_CONTAINER: 'data-sortable-container',
	COLUMN_POSITION: 'data-column-position',
	COLUMN_COLOR: 'data-column-color',
} as const;

/** CSS class names */
export const CSS_CLASSES = {
	// Container
	VIEW_CONTAINER: 'fbk-view-container',
	BOARD: 'fbk-board',

	// Column
	COLUMN: 'fbk-column',
	COLUMN_HEADER: 'fbk-column-header',
	COLUMN_TITLE: 'fbk-column-title',
	COLUMN_COUNT: 'fbk-column-count',
	COLUMN_BODY: 'fbk-column-body',
	COLUMN_DRAG_HANDLE: 'fbk-column-drag-handle',
	COLUMN_DRAGGING: 'fbk-column-dragging',
	COLUMN_GHOST: 'fbk-column-ghost',

	// Card
	CARD: 'fbk-card',
	CARD_TITLE: 'fbk-card-title',
	CARD_ACTIVE: 'fbk-card--active',
	CARD_HOVER: 'fbk-card--hover',
	CARD_DRAGGING: 'fbk-card-dragging',
	CARD_GHOST: 'fbk-card-ghost',
	CARD_CHOSEN: 'fbk-card-chosen',
	CARD_TAGS: 'fbk-card-tags',
	CARD_TAG: 'fbk-card-tag',
	CARD_PREVIEW: 'fbk-card-preview',

	// Empty state
	EMPTY_STATE: 'fbk-empty-state',

	// Sortable placeholder (fallback / shared ghost style)
	SORTABLE_GHOST: 'fbk-sortable-ghost',

	// Column remove button (shown only when column is empty)
	COLUMN_REMOVE_BTN: 'fbk-column-remove-btn',

	// Color picker
	COLUMN_COLOR_BTN: 'fbk-column-color-btn',
	COLUMN_COLOR_POPOVER: 'fbk-column-color-popover',
	COLUMN_COLOR_SWATCH: 'fbk-column-color-swatch',
	COLUMN_COLOR_SWATCH_ACTIVE: 'fbk-column-color-swatch--active',
	COLUMN_COLOR_NONE: 'fbk-column-color-none',
} as const;

/** Sortable.js configuration constants */
export const SORTABLE_CONFIG = {
	ANIMATION_DURATION: 150,
} as const;

/** Debounce delay in ms for vault-event triggered renders */
export const DEBOUNCE_DELAY = 50;

/** Empty state messages */
export const EMPTY_STATE_MESSAGES = {
	NO_ROOT_FOLDER: 'No root folder selected. Choose one in the view options.',
	NO_SUBFOLDERS: 'No subfolders found. Create subfolders in the root folder to use as columns.',
} as const;
