import { TFile, TFolder, type Vault } from 'obsidian';
import { UNSORTED_LABEL } from './constants.ts';
import type { CardData, ColumnData } from './types.ts';

function toCard(file: TFile): CardData {
	return { filePath: file.path, fileName: file.basename };
}

/**
 * Scans the root folder and returns column data.
 * Each immediate subfolder becomes a column; .md files in each subfolder become cards.
 * .md files directly in the root become an "Unsorted" column (only if any exist).
 */
export function scanRootFolder(vault: Vault, rootFolder: string): ColumnData[] {
	const root = vault.getAbstractFileByPath(rootFolder);
	if (!(root instanceof TFolder)) return [];

	const columns: ColumnData[] = [];
	const unsortedCards: CardData[] = [];

	for (const child of root.children) {
		if (child instanceof TFolder) {
			const cards: CardData[] = [];
			for (const file of child.children) {
				if (file instanceof TFile && file.extension === 'md') {
					cards.push(toCard(file));
				}
			}
			columns.push({
				folderName: child.name,
				folderPath: child.path,
				cards,
			});
		} else if (child instanceof TFile && child.extension === 'md') {
			unsortedCards.push(toCard(child));
		}
	}

	if (unsortedCards.length > 0) {
		columns.push({
			folderName: UNSORTED_LABEL,
			folderPath: rootFolder,
			cards: unsortedCards,
		});
	}

	return columns;
}
