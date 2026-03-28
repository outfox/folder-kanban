import { test, describe } from 'node:test';
import assert from 'node:assert';
import FolderKanbanPlugin, { VIEW_TYPE_FOLDER_KANBAN } from '../src/main.ts';
import { setupTestEnvironment, createMockApp } from './helpers.ts';

setupTestEnvironment();

describe('Plugin Registration', () => {
	test('VIEW_TYPE_FOLDER_KANBAN is defined', () => {
		assert.strictEqual(VIEW_TYPE_FOLDER_KANBAN, 'folder-kanban-view');
	});

	test('Plugin loads and registers view, command, ribbon, and settings tab', async () => {
		const app = createMockApp();
		const plugin = new FolderKanbanPlugin(app as any, {} as any);
		plugin.loadData = async () => null;

		let registeredViewType: string | null = null;
		let registeredCommand: any = null;
		let registeredRibbon = false;
		let registeredSettingsTab = false;

		plugin.registerView = (type: string, _factory: any) => {
			registeredViewType = type;
		};
		plugin.addCommand = (cmd: any) => {
			registeredCommand = cmd;
			return cmd;
		};
		plugin.addRibbonIcon = (_icon: string, _title: string, _cb: any) => {
			registeredRibbon = true;
			return document.createElement('div');
		};
		plugin.addSettingTab = (_tab: any) => {
			registeredSettingsTab = true;
		};

		await plugin.onload();

		assert.strictEqual(registeredViewType, VIEW_TYPE_FOLDER_KANBAN);
		assert.ok(registeredCommand, 'Command should be registered');
		assert.strictEqual(registeredCommand.id, 'open-folder-kanban');
		assert.ok(registeredRibbon, 'Ribbon icon should be registered');
		assert.ok(registeredSettingsTab, 'Settings tab should be registered');
	});

	test('loadSettings merges with defaults', async () => {
		const app = createMockApp();
		const plugin = new FolderKanbanPlugin(app as any, {} as any);
		plugin.loadData = async () => ({ settings: { rootFolder: 'MyBoard' }, columnColors: { Todo: 'red' } });

		await plugin.loadSettings();

		assert.strictEqual(plugin.state.settings.rootFolder, 'MyBoard');
		assert.deepStrictEqual(plugin.state.columnColors, { Todo: 'red' });
		assert.deepStrictEqual(plugin.state.columnOrder, []);
	});

	test('loadSettings handles null data', async () => {
		const app = createMockApp();
		const plugin = new FolderKanbanPlugin(app as any, {} as any);
		plugin.loadData = async () => null;

		await plugin.loadSettings();

		assert.strictEqual(plugin.state.settings.rootFolder, '');
		assert.deepStrictEqual(plugin.state.columnOrder, []);
	});
});
