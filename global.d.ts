import { type TFile } from 'obsidian';
import '@total-typescript/ts-reset';
import { type ObjectFile } from 'src/types';

declare global {
	declare const ExcalidrawAutomate:
		| {
				isExcalidrawFile(file: TFile): boolean;
		  }
		| undefined;

	interface Window {
		oot?: {
			getObjectFileByPath: (unparsedPath: unknown) => ObjectFile | null;
			getObjectFileByLink: (unparsedLink: unknown) => ObjectFile | null;
		};
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
