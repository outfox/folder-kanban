// Mock obsidian module for testing

export class TAbstractFile {
	path = '';
	name = '';
	vault: any = {};
	parent: any = null;
}

export class TFile extends TAbstractFile {
	basename = '';
	extension = '';
	stat = { size: 0, ctime: 0, mtime: 0 };
}

export class TFolder extends TAbstractFile {
	children: (TFile | TFolder)[] = [];
	isRoot(): boolean {
		return false;
	}
}

export interface Vault {
	getAbstractFileByPath(path: string): TAbstractFile | null;
	rename(file: TAbstractFile, newPath: string): Promise<void>;
	on(event: string, callback: (...args: any[]) => void): { id: string };
}

export interface Workspace {
	openLinkText(path: string, source: string, newLeaf: boolean): Promise<void>;
	getLeavesOfType(type: string): any[];
	getLeaf(type?: string): any;
	revealLeaf(leaf: any): void;
}

export interface App {
	vault: Vault;
	workspace: Workspace;
}

export class ItemView {
	leaf: any;
	app: App;
	contentEl: HTMLElement;
	private _registeredEvents: any[] = [];

	constructor(leaf: any) {
		this.leaf = leaf;
		this.app = leaf.app;
		this.contentEl = document.createElement('div');
	}

	getViewType(): string {
		return '';
	}

	getDisplayText(): string {
		return '';
	}

	getIcon(): string {
		return '';
	}

	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}

	registerEvent(eventRef: any): void {
		this._registeredEvents.push(eventRef);
	}
}

export class Plugin {
	app: App;
	manifest: any;

	constructor(app: App, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	async onload(): Promise<void> {}
	onunload(): void {}

	registerView(_type: string, _factory: (leaf: any) => any): void {}
	addSettingTab(_tab: any): void {}
	addCommand(_command: any): void {}
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
		return document.createElement('div');
	}
	async loadData(): Promise<any> {
		return null;
	}
	async saveData(_data: any): Promise<void> {}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: HTMLElement;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement('div');
	}

	display(): void {}
	hide(): void {}
}

export class Setting {
	settingEl: HTMLElement;
	private _name = '';
	private _desc = '';

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement('div');
		containerEl.appendChild(this.settingEl);
	}

	setName(name: string): this {
		this._name = name;
		return this;
	}

	setDesc(desc: string): this {
		this._desc = desc;
		return this;
	}

	addText(cb: (text: any) => void): this {
		const text = {
			_value: '',
			_placeholder: '',
			_onChange: null as any,
			setPlaceholder(p: string) {
				this._placeholder = p;
				return this;
			},
			setValue(v: string) {
				this._value = v;
				return this;
			},
			onChange(fn: (value: string) => void) {
				this._onChange = fn;
				return this;
			},
		};
		cb(text);
		return this;
	}
}

export class Notice {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}

export class WorkspaceLeaf {
	app: App;
	view: any;

	constructor(app: App) {
		this.app = app;
	}

	async setViewState(_state: any): Promise<void> {}
}
