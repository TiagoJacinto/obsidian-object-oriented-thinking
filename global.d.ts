import { type TFile } from 'obsidian';
import '@total-typescript/ts-reset';
import { type Link } from 'obsidian-dev-utils/obsidian/Dataview';

declare global {
	declare const ExcalidrawAutomate:
		| {
				isExcalidrawFile(file: TFile): boolean;
		  }
		| undefined;

	interface Window {
		tagOfObjectLink?: (link: Link | `[[${string}]]`) => Promise<string | undefined>;
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
