import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FolderKanbanView } from '../src/kanbanView.ts';
import { CSS_CLASSES, DATA_ATTRIBUTES, UNSORTED_LABEL } from '../src/constants.ts';
import {
	setupTestEnvironment,
	createMockApp,
	createMockVault,
	createMockPlugin,
	createMockLeaf,
	buildFileTree,
} from './helpers.ts';
import { createStandardFileTree, createFileTreeWithUnsorted } from './fixtures.ts';

setupTestEnvironment();

async function openView(rootFolder: string, fileTree: Map<string, any>, extraState: Record<string, any> = {}) {
	const vault = createMockVault(fileTree);
	const app = createMockApp(vault);
	const plugin = createMockPlugin({ settings: { rootFolder }, ...extraState }, app as any);
	const leaf = createMockLeaf(app as any);
	const view = new FolderKanbanView(leaf, plugin);
	await view.onOpen();
	return { view, plugin, vault, app };
}

describe('FolderKanbanView', () => {
	describe('rendering', () => {
		test('renders columns for subfolders', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree);

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			assert.strictEqual(columns.length, 3);

			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.ok(names.includes('Todo'));
			assert.ok(names.includes('Doing'));
			assert.ok(names.includes('Done'));
		});

		test('renders cards within columns', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree);

			const cards = view.contentEl.querySelectorAll(`.${CSS_CLASSES.CARD}`);
			assert.strictEqual(cards.length, 5);
		});

		test('shows empty state when no root folder configured', async () => {
			const { view } = await openView('', new Map());

			const emptyState = view.contentEl.querySelector(`.${CSS_CLASSES.EMPTY_STATE}`);
			assert.ok(emptyState);
			assert.ok(emptyState?.textContent?.includes('No root folder'));
		});

		test('shows empty state when root folder not found', async () => {
			const { view } = await openView('NonExistent', new Map());

			const emptyState = view.contentEl.querySelector(`.${CSS_CLASSES.EMPTY_STATE}`);
			assert.ok(emptyState);
		});

		test('shows Unsorted column when root has .md files', async () => {
			const tree = createFileTreeWithUnsorted();
			const { view } = await openView('Board', tree);

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.ok(unsortedCol, 'Unsorted column should exist');
		});

		test('hides Unsorted column when root has no .md files', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree);

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.strictEqual(unsortedCol, undefined);
		});

		test('Unsorted column has no drag handle', async () => {
			const tree = createFileTreeWithUnsorted();
			const { view } = await openView('Board', tree);

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const unsortedCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
			assert.ok(unsortedCol);
			const handle = unsortedCol?.querySelector(`.${CSS_CLASSES.COLUMN_DRAG_HANDLE}`);
			assert.strictEqual(handle, null, 'Unsorted column should have no drag handle');
		});
	});

	describe('column ordering', () => {
		test('applies saved column order', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree, {
				columnOrder: ['Done', 'Doing', 'Todo'],
			});

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.deepStrictEqual(names, ['Done', 'Doing', 'Todo']);
		});

		test('sorts alphabetically when no saved order', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree);

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const names = Array.from(columns).map((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE));
			assert.deepStrictEqual(names, ['Doing', 'Done', 'Todo']);
		});

		test('Unsorted column always appears last', async () => {
			const tree = createFileTreeWithUnsorted();
			const { view } = await openView('Board', tree, {
				columnOrder: ['Done', 'Todo'],
			});

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const lastCol = columns[columns.length - 1];
			assert.strictEqual(lastCol?.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE), UNSORTED_LABEL);
		});
	});

	describe('card ordering', () => {
		test('applies saved card order', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree, {
				cardOrders: { Todo: ['Board/Todo/Task 2.md', 'Board/Todo/Task 1.md'] },
			});

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const todoCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo');
			const cards = todoCol?.querySelectorAll(`.${CSS_CLASSES.CARD}`);
			assert.ok(cards && cards.length === 2);
			assert.strictEqual((cards[0] as HTMLElement).getAttribute(DATA_ATTRIBUTES.ENTRY_PATH), 'Board/Todo/Task 2.md');
			assert.strictEqual((cards[1] as HTMLElement).getAttribute(DATA_ATTRIBUTES.ENTRY_PATH), 'Board/Todo/Task 1.md');
		});
	});

	describe('column colors', () => {
		test('applies saved column colors', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree, {
				columnColors: { Todo: 'red' },
			});

			const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
			const todoCol = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo');
			assert.ok(todoCol);
			assert.strictEqual(todoCol?.getAttribute(DATA_ATTRIBUTES.COLUMN_COLOR), 'red');
		});
	});

	describe('cleanup', () => {
		test('onClose cleans up without errors', async () => {
			const tree = createStandardFileTree();
			const { view } = await openView('Board', tree);

			await assert.doesNotReject(async () => {
				await view.onClose();
			});
		});
	});
});
