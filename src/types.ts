export interface CardData {
	filePath: string;
	fileName: string;
}

export interface ColumnData {
	folderName: string;
	folderPath: string;
	cards: CardData[];
}
