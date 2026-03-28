import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { FolderKanbanView } from './kanbanView.ts';
import { FolderKanbanSettingTab } from './settingsTab.ts';
import type { PersistedState } from './types.ts';
import { DEFAULT_STATE } from './types.ts';

export const VIEW_TYPE_FOLDER_KANBAN = 'folder-kanban-view';

export default class FolderKanbanPlugin extends Plugin {
	state: PersistedState = { ...DEFAULT_STATE };

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_FOLDER_KANBAN, (leaf: WorkspaceLeaf) => new FolderKanbanView(leaf, this));

		this.addSettingTab(new FolderKanbanSettingTab(this));

		this.addCommand({
			id: 'open-folder-kanban',
			name: 'Open folder kanban',
			callback: () => {
				void this.activateView();
			},
		});

		this.addRibbonIcon('columns-3', 'Folder kanban', () => {
			void this.activateView();
		});
	}

	async loadSettings(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- loadData() returns `any`
		const raw = (await this.loadData()) as PersistedState | null;
		if (raw) {
			this.state = { ...DEFAULT_STATE, ...raw };
			this.state.settings = { ...DEFAULT_STATE.settings, ...raw.settings };
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.state);
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_FOLDER_KANBAN)) {
			if (leaf.view instanceof FolderKanbanView) {
				leaf.view.refresh();
			}
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_FOLDER_KANBAN);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_FOLDER_KANBAN, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
