import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FolderKanbanView } from '../src/kanbanView.ts';
import { CSS_CLASSES, DATA_ATTRIBUTES, UNSORTED_LABEL } from '../src/constants.ts';
import {
	setupTestEnvironment,
	createDivWithMethods,
	createMockQueryController,
	createMockApp,
	triggerDataUpdate,
} from './helpers.ts';
import { createStandardEntries, createEntriesWithUnsorted, createEmptyEntries } from './fixtures.ts';

setupTestEnvironment();

function createView(entries: any[], rootFolder: string, configOverrides: Record<string, unknown> = {}, app?: any) {
	const scrollEl = createDivWithMethods();
	const controller = createMockQueryController(entries, { rootFolder, ...configOverrides }, app);
	const view = new FolderKanbanView(controller, scrollEl);
	return { view, scrollEl, controller };
}

function createAndRender(entries: any[], rootFolder: string, configOverrides: Record<string, unknown> = {}, app?: any) {
	const result = createView(entries, rootFolder, configOverrides, app);
	triggerDataUpdate(result.view);
	return result;
}

describe('FolderKanbanView', () => {
	describe('rendering', () => {
		test('renders columns for subfolders', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board');
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			assert.strictEqual(columns.length, 3);

			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.ok(names.includes('Todo'));
			assert.ok(names.includes('Doing'));
			assert.ok(names.includes('Done'));
		});

		test('renders cards within columns', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board');
			const cards = view.containerEl.querySelectorAll(`.${CSS_CLASSES.CARD}`);
			assert.strictEqual(cards.length, 5);
		});

		test('shows empty state when no entries', () => {
			const { view } = createAndRender(createEmptyEntries(), 'Board');
			const emptyState = view.containerEl.querySelector(`.${CSS_CLASSES.EMPTY_STATE}`);
			assert.ok(emptyState);
		});

		test('shows empty state when no root folder configured', () => {
			const { view } = createAndRender(createStandardEntries(), '');
			const emptyState = view.containerEl.querySelector(`.${CSS_CLASSES.EMPTY_STATE}`);
			assert.ok(emptyState);
			assert.ok(emptyState?.textContent?.includes('root folder'));
		});

		test('shows Unsorted column when root has direct .md files', () => {
			const { view } = createAndRender(createEntriesWithUnsorted(), 'Board');
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.ok(unsortedCol, 'Unsorted column should exist');
		});

		test('hides Unsorted column when no direct root files', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board');
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.strictEqual(unsortedCol, undefined);
		});

		test('Unsorted column has no drag handle', () => {
			const { view } = createAndRender(createEntriesWithUnsorted(), 'Board');
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.ok(unsortedCol);
			const handle = unsortedCol?.querySelector(`.${CSS_CLASSES.COLUMN_DRAG_HANDLE}`);
			assert.strictEqual(handle, null);
		});
	});

	describe('column ordering', () => {
		test('applies saved column order', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board', {
				columnOrder: ['Done', 'Doing', 'Todo'],
			});
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.deepStrictEqual(names, ['Done', 'Doing', 'Todo']);
		});

		test('sorts alphabetically when no saved order', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board');
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.deepStrictEqual(names, ['Doing', 'Done', 'Todo']);
		});

		test('Unsorted column always appears last', () => {
			const { view } = createAndRender(createEntriesWithUnsorted(), 'Board', {
				columnOrder: ['Done', 'Todo'],
			});
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const lastCol = columns[columns.length - 1];
			assert.strictEqual(lastCol?.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE), UNSORTED_LABEL);
		});
	});

	describe('card ordering', () => {
		test('applies saved card order', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board', {
				cardOrders: { Todo: ['Board/Todo/Task 2.md', 'Board/Todo/Task 1.md'] },
			});
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const todoCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo');
			const cards = todoCol?.querySelectorAll(`.${CSS_CLASSES.CARD}`);
			assert.ok(cards && cards.length === 2);
			assert.strictEqual((cards[0] as HTMLElement).getAttribute(DATA_ATTRIBUTES.ENTRY_PATH), 'Board/Todo/Task 2.md');
			assert.strictEqual((cards[1] as HTMLElement).getAttribute(DATA_ATTRIBUTES.ENTRY_PATH), 'Board/Todo/Task 1.md');
		});
	});

	describe('column colors', () => {
		test('applies saved column colors', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board', {
				columnColors: { Todo: 'red' },
			});
			const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const todoCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo');
			assert.ok(todoCol);
			assert.strictEqual(todoCol?.getAttribute(DATA_ATTRIBUTES.COLUMN_COLOR), 'red');
		});
	});

	describe('cleanup', () => {
		test('onClose cleans up without errors', () => {
			const { view } = createAndRender(createStandardEntries(), 'Board');
			assert.doesNotThrow(() => {
				view.onClose();
			});
		});
	});
});
