import { PluginSettingTab, Setting } from 'obsidian';
import type FolderKanbanPlugin from './main.ts';

export class FolderKanbanSettingTab extends PluginSettingTab {
	plugin: FolderKanbanPlugin;

	constructor(plugin: FolderKanbanPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Root folder')
			.setDesc('The folder whose subfolders become kanban columns.')
			.addText((text) => {
				text
					.setPlaceholder('e.g. Projects/Board')
					.setValue(this.plugin.state.settings.rootFolder)
					.onChange(async (value) => {
						this.plugin.state.settings.rootFolder = value.trim();
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
			});
	}
}
