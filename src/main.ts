import { Plugin } from 'obsidian';
import { FolderKanbanView } from './kanbanView.ts';

export const KANBAN_VIEW_TYPE = 'folder-kanban-view';

export default class FolderKanbanPlugin extends Plugin {
	async onload() {
		this.registerBasesView(KANBAN_VIEW_TYPE, {
			name: 'Folder kanban',
			icon: 'columns-3',
			factory: (controller, scrollEl) => {
				return new FolderKanbanView(controller, scrollEl);
			},
			options: FolderKanbanView.getViewOptions,
		});
	}
}
