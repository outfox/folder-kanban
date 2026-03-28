import { JSDOM } from 'jsdom';
import { mock } from 'node:test';
import { TFile, TFolder } from 'obsidian';
import type { App } from 'obsidian';
import { DEBOUNCE_DELAY } from '../src/constants.ts';
import type { PersistedState } from '../src/types.ts';
import { DEFAULT_STATE } from '../src/types.ts';

// Setup jsdom environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
	url: 'http://localhost',
	pretendToBeVisual: true,
	resources: 'usable',
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).HTMLDivElement = dom.window.HTMLDivElement;
(global as any).Element = dom.window.Element;
(global as any).MouseEvent = dom.window.MouseEvent;

// Extend HTMLElement prototype with Obsidian-like methods
const HTMLElementProto = dom.window.HTMLElement.prototype as any;

if (!HTMLElementProto.createDiv) {
	HTMLElementProto.createDiv = function (options?: { cls?: string; text?: string }): HTMLElement {
		const child = document.createElement('div');
		if (options?.cls) child.className = options.cls;
		if (options?.text) child.textContent = options.text;
		this.appendChild(child);
		return child;
	};
}

if (!HTMLElementProto.createSpan) {
	HTMLElementProto.createSpan = function (options?: { text?: string; cls?: string }): HTMLElement {
		const span = document.createElement('span');
		if (options?.text) span.textContent = options.text;
		if (options?.cls) span.className = options.cls;
		this.appendChild(span);
		return span;
	};
}

if (!HTMLElementProto.createEl) {
	HTMLElementProto.createEl = function (tag: string, options?: { cls?: string; text?: string }): HTMLElement {
		const el = document.createElement(tag);
		if (options?.cls) el.className = options.cls;
		if (options?.text) el.textContent = options.text;
		this.appendChild(el);
		return el;
	};
}

if (!HTMLElementProto.empty) {
	HTMLElementProto.empty = function (): void {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
}

if (!HTMLElementProto.addClass) {
	HTMLElementProto.addClass = function (cls: string): void {
		this.classList.add(cls);
	};
}

if (!HTMLElementProto.removeClass) {
	HTMLElementProto.removeClass = function (cls: string): void {
		this.classList.remove(cls);
	};
}

export function createMockTFile(path: string): TFile {
	const name = path.split('/').pop() || path;
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = name.replace(/\.[^/.]+$/, '');
	file.extension = name.split('.').pop() || '';
	file.stat = { size: 100, ctime: Date.now(), mtime: Date.now() };
	return file;
}

export function createMockTFolder(path: string, children: (TFile | TFolder)[] = []): TFolder {
	const folder = new TFolder();
	folder.path = path;
	folder.name = path.split('/').pop() || path;
	folder.children = children;
	return folder;
}

export interface MockFn {
	(...args: any[]): any;
	calls: any[][];
	reset(): void;
}

export function createMockFn(): MockFn {
	const calls: any[][] = [];
	const fn = function (...args: any[]) {
		calls.push(args);
		return Promise.resolve();
	} as MockFn;
	fn.calls = calls;
	fn.reset = () => {
		calls.length = 0;
	};
	return fn;
}

export function createMockVault(fileTree: Map<string, TFile | TFolder> = new Map()) {
	const renameFn = createMockFn();
	const eventHandlers = new Map<string, ((...args: any[]) => void)[]>();

	return {
		getAbstractFileByPath: (path: string) => fileTree.get(path) ?? null,
		rename: renameFn as any,
		on: (event: string, callback: (...args: any[]) => void) => {
			if (!eventHandlers.has(event)) eventHandlers.set(event, []);
			eventHandlers.get(event)!.push(callback);
			return { id: `${event}-${Date.now()}` };
		},
		renameFn,
		eventHandlers,
	} as any;
}

export function createMockApp(vault?: any) {
	const v = vault ?? createMockVault();
	const openLinkText = createMockFn();
	return {
		vault: v,
		workspace: {
			openLinkText,
			getLeavesOfType: (): any[] => [],
			getLeaf: () => ({ setViewState: async () => {} }),
			revealLeaf: () => {},
		},
	} as any;
}

export function createMockLeaf(app?: App): any {
	const a = app ?? createMockApp();
	return { app: a };
}

export function createMockPlugin(state?: Partial<PersistedState>, app?: App): any {
	const a = app ?? createMockApp();
	const s = { ...DEFAULT_STATE, ...state, settings: { ...DEFAULT_STATE.settings, ...(state?.settings ?? {}) } };
	return {
		app: a,
		state: s,
		saveSettings: createMockFn(),
		refreshViews: () => {},
	};
}

/** Build a file tree for testing: root folder with subfolders containing .md files. */
export function buildFileTree(
	rootPath: string,
	subfolders: Record<string, string[]>,
	rootFiles: string[] = [],
): Map<string, TFile | TFolder> {
	const tree = new Map<string, TFile | TFolder>();

	const rootChildren: (TFile | TFolder)[] = [];

	// Root-level .md files
	for (const fileName of rootFiles) {
		const filePath = `${rootPath}/${fileName}`;
		const file = createMockTFile(filePath);
		tree.set(filePath, file);
		rootChildren.push(file);
	}

	// Subfolders
	for (const [folderName, files] of Object.entries(subfolders)) {
		const folderPath = `${rootPath}/${folderName}`;
		const folderChildren: TFile[] = [];

		for (const fileName of files) {
			const filePath = `${folderPath}/${fileName}`;
			const file = createMockTFile(filePath);
			tree.set(filePath, file);
			folderChildren.push(file);
		}

		const folder = createMockTFolder(folderPath, folderChildren);
		tree.set(folderPath, folder);
		rootChildren.push(folder);
	}

	const rootFolder = createMockTFolder(rootPath, rootChildren);
	tree.set(rootPath, rootFolder);

	return tree;
}

export function setupTestEnvironment(): void {
	if (typeof document === 'undefined') {
		const newDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		(global as any).document = newDom.window.document;
		(global as any).window = newDom.window;
		(global as any).HTMLElement = newDom.window.HTMLElement;
	}
}

export function createDivWithMethods(): HTMLElement {
	return document.createElement('div');
}

export function createMockSortableEvent(
	item: HTMLElement,
	from: HTMLElement,
	to: HTMLElement,
	oldIndex: number = 0,
	newIndex: number = 0,
): any {
	return { item, from, to, oldIndex, newIndex };
}

/**
 * Triggers a refresh on a FolderKanbanView and synchronously flushes the debounce.
 */
export function triggerRefresh(view: any): void {
	mock.timers.enable({ apis: ['setTimeout'] });
	view.refresh();
	mock.timers.tick(DEBOUNCE_DELAY);
	mock.timers.reset();
}
