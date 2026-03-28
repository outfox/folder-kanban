import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scanRootFolder } from '../src/folderScanner.ts';
import { UNSORTED_LABEL } from '../src/constants.ts';
import { setupTestEnvironment, createMockVault, createMockTFile, createMockTFolder } from './helpers.ts';
import { createStandardFileTree, createFileTreeWithUnsorted, createEmptyFileTree } from './fixtures.ts';

setupTestEnvironment();

describe('scanRootFolder', () => {
	test('returns columns for each subfolder', () => {
		const tree = createStandardFileTree();
		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');

		assert.strictEqual(columns.length, 3);
		const names = columns.map((c) => c.folderName).sort();
		assert.deepStrictEqual(names, ['Doing', 'Done', 'Todo']);
	});

	test('returns cards within subfolders', () => {
		const tree = createStandardFileTree();
		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');

		const todo = columns.find((c) => c.folderName === 'Todo');
		assert.ok(todo);
		assert.strictEqual(todo.cards.length, 2);
		assert.ok(todo.cards.some((c) => c.fileName === 'Task 1'));
		assert.ok(todo.cards.some((c) => c.fileName === 'Task 2'));
	});

	test('returns empty array for non-existent root', () => {
		const vault = createMockVault(new Map());
		const columns = scanRootFolder(vault, 'NonExistent');
		assert.strictEqual(columns.length, 0);
	});

	test('includes Unsorted column for root-level .md files', () => {
		const tree = createFileTreeWithUnsorted();
		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');

		const unsorted = columns.find((c) => c.folderName === UNSORTED_LABEL);
		assert.ok(unsorted, 'Unsorted column should exist');
		assert.strictEqual(unsorted.cards.length, 1);
		assert.strictEqual(unsorted.cards[0].fileName, 'Unsorted Task');
	});

	test('does not include Unsorted when no root-level files', () => {
		const tree = createStandardFileTree();
		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');

		const unsorted = columns.find((c) => c.folderName === UNSORTED_LABEL);
		assert.strictEqual(unsorted, undefined);
	});

	test('returns empty columns for subfolders with no .md files', () => {
		const tree = createEmptyFileTree();
		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');
		assert.strictEqual(columns.length, 0);
	});

	test('ignores non-.md files in subfolders', () => {
		const tree = new Map<string, any>();
		const mdFile = createMockTFile('Board/Todo/task.md');
		const imgFile = createMockTFile('Board/Todo/image.png');
		const todoFolder = createMockTFolder('Board/Todo', [mdFile, imgFile]);
		tree.set('Board/Todo/task.md', mdFile);
		tree.set('Board/Todo/image.png', imgFile);
		tree.set('Board/Todo', todoFolder);
		tree.set('Board', createMockTFolder('Board', [todoFolder]));

		const vault = createMockVault(tree);
		const columns = scanRootFolder(vault, 'Board');

		assert.strictEqual(columns.length, 1);
		assert.strictEqual(columns[0].cards.length, 1);
		assert.strictEqual(columns[0].cards[0].fileName, 'task');
	});
});
