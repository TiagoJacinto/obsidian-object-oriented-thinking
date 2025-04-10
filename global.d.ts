import { type TFile } from 'obsidian';
import '@total-typescript/ts-reset';

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
	interface App {
		dom: {
			appContainerEl: HTMLElement;
		};
	}

	interface TFile {
		deleted: boolean;
	}
}
