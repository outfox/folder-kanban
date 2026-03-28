export interface CardData {
	filePath: string;
	fileName: string;
}

export interface ColumnData {
	folderName: string;
	folderPath: string;
	cards: CardData[];
}

export interface FolderKanbanSettings {
	rootFolder: string;
}

export interface PersistedState {
	settings: FolderKanbanSettings;
	columnOrder: string[];
	columnColors: Record<string, string>;
	cardOrders: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: FolderKanbanSettings = {
	rootFolder: '',
};

export const DEFAULT_STATE: PersistedState = {
	settings: { rootFolder: '' },
	columnOrder: [],
	columnColors: {},
	cardOrders: {},
};
