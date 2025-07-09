import { type TFile } from 'obsidian';

export type Frontmatter = {
	[key: string]: unknown;

	tags?: string[];
};

export type ObjectFile = TFile & {
	isDescendantOf: (unparsedParentFile: unknown) => boolean;
};
