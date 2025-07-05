import { type TFile } from 'obsidian';
import '@total-typescript/ts-reset';
import { type ObjectFile, type View } from './src/types';

declare global {
	declare const ExcalidrawAutomate:
		| {
				isExcalidrawFile(file: TFile): boolean;
		  }
		| undefined;

	interface Window {
		oot?: {
			utilities: {
				isObjectFile: (unparsedFile: unknown) => boolean;

				parentObjectFileByLiteralLink: (unparsedLiteralLink: unknown) => TFile | null;
				parentObjectFileByPath: (unparsedPath: unknown) => TFile | null;

				childObjectFileByPath: (unparsedPath: unknown) => ObjectFile | null;

				objectHierarchyByPath: (unparsedPath: unknown) => string[] | null;
				objectHierarchyByFile: (unparsedFile: unknown) => string[] | null;
			};
			views?: Record<string, View>;
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
