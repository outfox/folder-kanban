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
	createMockSortableEvent,
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

describe('Integration: Card click opens note', () => {
	test('clicking a card calls workspace.openLinkText', async () => {
		const tree = createStandardFileTree();
		const { view, app } = await openView('Board', tree);

		const card = view.contentEl.querySelector(`.${CSS_CLASSES.CARD}`) as HTMLElement;
		assert.ok(card);

		card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const openFn = (app.workspace as any).openLinkText;
		assert.strictEqual(openFn.calls.length, 1, 'openLinkText should be called once');
	});
});

describe('Integration: Drag-drop same column reorder', () => {
	test('same-column drop updates card orders', async () => {
		const tree = createStandardFileTree();
		const { view, plugin } = await openView('Board', tree);

		const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const todoCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo',
		) as HTMLElement;
		assert.ok(todoCol);
		const body = todoCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;
		assert.ok(body);

		const cards = body.querySelectorAll(`.${CSS_CLASSES.CARD}`);
		assert.ok(cards.length >= 2);

		const evt = createMockSortableEvent(cards[0] as HTMLElement, body, body);
		await (view as any).handleCardDrop(evt);

		assert.ok(plugin.saveSettings.calls.length > 0, 'saveSettings should be called');
	});
});

describe('Integration: Cross-column drag moves file', () => {
	test('cross-column drop calls vault.rename', async () => {
		const tree = createStandardFileTree();
		const { view, vault } = await openView('Board', tree);

		const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const todoCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo',
		) as HTMLElement;
		const doingCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Doing',
		) as HTMLElement;

		const todoBody = todoCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;
		const doingBody = doingCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;

		const card = todoBody.querySelector(`.${CSS_CLASSES.CARD}`) as HTMLElement;
		assert.ok(card);

		doingBody.appendChild(card);

		const evt = createMockSortableEvent(card, todoBody, doingBody);
		await (view as any).handleCardDrop(evt);

		assert.ok(vault.renameFn.calls.length > 0, 'vault.rename should be called');
		const [, newPath] = vault.renameFn.calls[0];
		assert.ok(newPath.startsWith('Board/Doing/'), `New path should be in Doing folder, got: ${newPath}`);
	});
});

describe('Integration: Unsorted column', () => {
	test('renders Unsorted column for root-level files', async () => {
		const tree = createFileTreeWithUnsorted();
		const { view } = await openView('Board', tree);

		const columns = view.contentEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const unsorted = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
		assert.ok(unsorted, 'Unsorted column should be rendered');

		const cards = unsorted?.querySelectorAll(`.${CSS_CLASSES.CARD}`);
		assert.strictEqual(cards?.length, 1);
	});
});
