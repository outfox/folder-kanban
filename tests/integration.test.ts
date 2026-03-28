import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FolderKanbanView } from '../src/kanbanView.ts';
import { CSS_CLASSES, DATA_ATTRIBUTES, UNSORTED_LABEL } from '../src/constants.ts';
import {
	setupTestEnvironment,
	createDivWithMethods,
	createMockQueryController,
	createMockApp,
	createMockSortableEvent,
	triggerDataUpdate,
} from './helpers.ts';
import { createStandardEntries, createEntriesWithUnsorted } from './fixtures.ts';

setupTestEnvironment();

async function createAndRender(entries: any[], rootFolder: string, app?: any) {
	const scrollEl = createDivWithMethods();
	const controller = createMockQueryController(entries, { rootFolder }, app);
	const view = new FolderKanbanView(controller, scrollEl);
	await triggerDataUpdate(view);
	return { view, controller, app: (controller as any).app };
}

describe('Integration: Card click opens note', () => {
	test('clicking a card calls workspace.openLinkText', async () => {
		const app = createMockApp();
		const { view } = await createAndRender(createStandardEntries(), 'Board', app);

		const card = view.containerEl.querySelector(`.${CSS_CLASSES.CARD}`) as HTMLElement;
		assert.ok(card);

		card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const openFn = (app.workspace as any).openLinkText;
		assert.strictEqual(openFn.calls.length, 1);
	});
});

describe('Integration: Drag-drop same column reorder', () => {
	test('same-column drop persists card orders', async () => {
		const { view, controller } = await createAndRender(createStandardEntries(), 'Board');

		const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const todoCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo',
		) as HTMLElement;
		const body = todoCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;
		const cards = body.querySelectorAll(`.${CSS_CLASSES.CARD}`);

		const evt = createMockSortableEvent(cards[0] as HTMLElement, body, body);
		void (view as any).handleCardDrop(evt);

		// Verify cardOrders was persisted via config.set
		const savedCardOrders = (controller as any).config.get('cardOrders');
		assert.ok(savedCardOrders, 'cardOrders should be persisted');
	});
});

describe('Integration: Cross-column drag moves file', () => {
	test('cross-column drop calls vault.rename', async () => {
		const entries = createStandardEntries();
		const fileTree = new Map(entries.map((e) => [e.file.path, e.file]));
		const app = createMockApp(fileTree);
		const { view } = await createAndRender(entries, 'Board', app);

		const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const todoCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Todo',
		) as HTMLElement;
		const doingCol = Array.from(columns).find(
			(c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === 'Doing',
		) as HTMLElement;

		const todoBody = todoCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;
		const doingBody = doingCol.querySelector(`.${CSS_CLASSES.COLUMN_BODY}`) as HTMLElement;

		const card = todoBody.querySelector(`.${CSS_CLASSES.CARD}`) as HTMLElement;
		doingBody.appendChild(card);

		const evt = createMockSortableEvent(card, todoBody, doingBody);
		await (view as any).handleCardDrop(evt);

		const renameFn = (app.vault as any).rename;
		assert.ok(renameFn.calls.length > 0, 'vault.rename should be called');
		const [, newPath] = renameFn.calls[0];
		assert.ok(newPath.startsWith('Board/Doing/'), `New path should be in Doing folder, got: ${newPath}`);
	});
});

describe('Integration: Unsorted column', () => {
	test('renders Unsorted column for root-level files', async () => {
		const { view } = await createAndRender(createEntriesWithUnsorted(), 'Board');

		const columns = view.containerEl.querySelectorAll(`.${CSS_CLASSES.COLUMN}`);
		const unsorted = Array.from(columns).find((c) => c.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) === UNSORTED_LABEL);
		assert.ok(unsorted, 'Unsorted column should be rendered');

		const cards = unsorted?.querySelectorAll(`.${CSS_CLASSES.CARD}`);
		assert.strictEqual(cards?.length, 1);
	});
});
