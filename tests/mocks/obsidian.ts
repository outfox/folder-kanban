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

export type BasesPropertyId = string;
export type ViewOption = any;

export interface BasesEntry {
	file: TFile;
	getValue(propertyId: BasesPropertyId): any;
}

export interface QueryController {
	data: { data: BasesEntry[] };
	allProperties: BasesPropertyId[];
	config: {
		get(key: string): unknown;
		set(key: string, value: any): void;
		getOrder(): BasesPropertyId[];
		getDisplayName(propertyId: BasesPropertyId): string;
		getAsPropertyId(key: string): BasesPropertyId | null;
	};
	app?: App;
}

export interface App {
	vault: {
		getAbstractFileByPath(path: string): TAbstractFile | null;
		rename(file: TAbstractFile, newPath: string): Promise<void>;
	};
	workspace: {
		openLinkText(path: string, source: string, newLeaf: boolean): void;
	};
}

export abstract class BasesView {
	app?: App;
	data?: { data: BasesEntry[] };
	allProperties?: BasesPropertyId[];
	config?: {
		get(key: string): unknown;
		set(key: string, value: any): void;
		getOrder(): BasesPropertyId[];
		getDisplayName(propertyId: BasesPropertyId): string;
		getAsPropertyId(key: string): BasesPropertyId | null;
	};

	constructor(controller: QueryController) {
		this.app = controller.app;
		this.data = controller.data;
		this.allProperties = controller.allProperties;
		this.config = controller.config;
	}

	abstract onDataUpdated(): void;
	onClose?(): void;
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

	registerBasesView?(_viewType: string, _options: any): void {}
	async loadData(): Promise<any> {
		return null;
	}
	async saveData(_data: any): Promise<void> {}
}

export class Notice {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}
