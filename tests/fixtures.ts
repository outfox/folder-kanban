import { buildFileTree } from './helpers.ts';

/** Standard kanban layout: Todo, Doing, Done subfolders with some .md files */
export function createStandardFileTree() {
	return buildFileTree('Board', {
		Todo: ['Task 1.md', 'Task 2.md'],
		Doing: ['Task 3.md'],
		Done: ['Task 4.md', 'Task 5.md'],
	});
}

/** File tree with files in the root folder (unsorted) */
export function createFileTreeWithUnsorted() {
	return buildFileTree(
		'Board',
		{
			Todo: ['Task 1.md'],
			Done: ['Task 2.md'],
		},
		['Unsorted Task.md'],
	);
}

/** Empty root folder (no subfolders, no files) */
export function createEmptyFileTree() {
	return buildFileTree('Board', {});
}

/** Single subfolder with one file */
export function createSingleColumnFileTree() {
	return buildFileTree('Board', {
		Inbox: ['Note.md'],
	});
}

/** Subfolders with no .md files */
export function createEmptySubfoldersFileTree() {
	return buildFileTree('Board', {
		Todo: [],
		Done: [],
	});
}
