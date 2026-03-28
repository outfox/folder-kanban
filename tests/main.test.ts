import { test, describe } from 'node:test';
import assert from 'node:assert';
import FolderKanbanPlugin, { KANBAN_VIEW_TYPE } from '../src/main.ts';
import { FolderKanbanView } from '../src/kanbanView.ts';
import { setupTestEnvironment, createDivWithMethods, createMockQueryController } from './helpers.ts';

setupTestEnvironment();

describe('Plugin Registration', () => {
	test('KANBAN_VIEW_TYPE is defined', () => {
		assert.strictEqual(KANBAN_VIEW_TYPE, 'folder-kanban-view');
	});

	test('Plugin registers BasesView correctly', async () => {
		let registeredViewType: string | null = null;
		let registeredName: string | null = null;
		let registeredIcon: string | null = null;

		const mockApp = {} as any;
		const plugin = new FolderKanbanPlugin(mockApp, {} as any);

		(plugin as any).registerBasesView = function (viewType: string, options: any) {
			registeredViewType = viewType;
			registeredName = options.name;
			registeredIcon = options.icon;

			const scrollEl = createDivWithMethods();
			const controller = createMockQueryController();
			options.factory(controller, scrollEl);
		};

		await plugin.onload();

		assert.strictEqual(registeredViewType, KANBAN_VIEW_TYPE);
		assert.strictEqual(registeredName, 'Folder kanban');
		assert.strictEqual(registeredIcon, 'columns-3');
	});

	test('Factory returns FolderKanbanView instance', async () => {
		const mockApp = {} as any;
		const plugin = new FolderKanbanPlugin(mockApp, {} as any);

		let factoryFn: any = null;
		(plugin as any).registerBasesView = function (_viewType: string, options: any) {
			factoryFn = options.factory;
		};

		await plugin.onload();

		assert.ok(factoryFn);
		const scrollEl = createDivWithMethods();
		const controller = createMockQueryController();
		const view = factoryFn(controller, scrollEl);
		assert.ok(view instanceof FolderKanbanView);
	});
});

describe('View Options', () => {
	test('getViewOptions returns expected options', () => {
		const options = FolderKanbanView.getViewOptions();

		assert.strictEqual(options.length, 4);
		assert.strictEqual(options[0].type, 'folder');
		assert.strictEqual(options[0].key, 'rootFolder');
		assert.strictEqual(options[1].type, 'toggle');
		assert.strictEqual(options[1].key, 'showTags');
		assert.strictEqual(options[2].type, 'toggle');
		assert.strictEqual(options[2].key, 'showPreview');
		assert.strictEqual(options[3].type, 'slider');
		assert.strictEqual(options[3].key, 'columnWidth');
	});
});
