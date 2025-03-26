import { type TFile } from 'obsidian';

declare global {
	declare const ExcalidrawAutomate:
		| {
				isExcalidrawFile(file: TFile): boolean;
		  }
		| undefined;

	interface Window {
		tagOfObjectLink?: (link: `[[${string}]]`) => Promise<string>;
	}
}

declare module 'obsidian' {
	interface TFile {
		deleted: boolean;
	}
}
