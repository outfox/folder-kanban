import { createMockTFile, createMockBasesEntry } from './helpers.ts';
import type { BasesEntry } from 'obsidian';

/** Entries in Board/Todo, Board/Doing, Board/Done subfolders */
export function createStandardEntries(): BasesEntry[] {
	return [
		createMockBasesEntry(createMockTFile('Board/Todo/Task 1.md')),
		createMockBasesEntry(createMockTFile('Board/Todo/Task 2.md')),
		createMockBasesEntry(createMockTFile('Board/Doing/Task 3.md')),
		createMockBasesEntry(createMockTFile('Board/Done/Task 4.md')),
		createMockBasesEntry(createMockTFile('Board/Done/Task 5.md')),
	];
}

/** Entries with some files directly in root folder (unsorted) */
export function createEntriesWithUnsorted(): BasesEntry[] {
	return [
		createMockBasesEntry(createMockTFile('Board/Todo/Task 1.md')),
		createMockBasesEntry(createMockTFile('Board/Done/Task 2.md')),
		createMockBasesEntry(createMockTFile('Board/Loose Note.md')),
	];
}

/** Single entry */
export function createSingleEntry(): BasesEntry[] {
	return [createMockBasesEntry(createMockTFile('Board/Inbox/Note.md'))];
}

/** No entries */
export function createEmptyEntries(): BasesEntry[] {
	return [];
}
