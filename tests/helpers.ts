import { JSDOM } from 'jsdom';
import { mock } from 'node:test';
import { TFile } from 'obsidian';
import type { App, BasesEntry, BasesPropertyId, QueryController } from 'obsidian';
import { DEBOUNCE_DELAY } from '../src/constants.ts';

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

if (!HTMLElementProto.empty) {
	HTMLElementProto.empty = function (): void {
		while (this.firstChild) this.removeChild(this.firstChild);
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

export function createMockBasesEntry(file: TFile): BasesEntry {
	return {
		file,
		getValue: (_propertyId: BasesPropertyId) => null,
	} as BasesEntry;
}

export function createMockApp(fileTree?: Map<string, any>): App {
	const tree = fileTree ?? new Map();
	const renameFn = createMockFn();
	const openLinkText = createMockFn();

	return {
		vault: {
			getAbstractFileByPath: (path: string) => tree.get(path) ?? null,
			rename: renameFn,
		},
		workspace: {
			openLinkText,
		},
	} as any;
}

export function createMockQueryController(
	entries: BasesEntry[] = [],
	configData: Record<string, unknown> = {},
	app?: App,
): QueryController {
	const data = { ...configData };
	return {
		data: { data: entries },
		allProperties: [],
		config: {
			get: (key: string): unknown => data[key] ?? null,
			set: (key: string, value: unknown): void => {
				data[key] = value;
			},
			getOrder: (): string[] => [],
			getDisplayName: (id: string): string => id,
			getAsPropertyId: (_key: string): string | null => null,
		},
		app: app ?? createMockApp(),
	} as unknown as QueryController;
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

export function setupTestEnvironment(): void {
	if (typeof document === 'undefined') {
		const newDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		(global as any).document = newDom.window.document;
		(global as any).window = newDom.window;
		(global as any).HTMLElement = newDom.window.HTMLElement;
	}
}

/**
 * Triggers onDataUpdated on a view and synchronously flushes the debounce.
 */
export function triggerDataUpdate(view: any): void {
	mock.timers.enable({ apis: ['setTimeout'] });
	view.onDataUpdated();
	mock.timers.tick(DEBOUNCE_DELAY);
	mock.timers.reset();
}
