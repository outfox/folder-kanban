export interface CardData {
	filePath: string;
	fileName: string;
	tags: string[];
	preview: string;
}

export interface ColumnData {
	folderName: string;
	folderPath: string;
	cards: CardData[];
}
