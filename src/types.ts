export type Frontmatter = {
	[key: string]: unknown;

	tags?: string[];
};

export type ObjectFile = {
	isObjectOf: (unparsedFile: unknown) => boolean;
	isDescendentOf: (unparsedParentFile: unknown) => boolean;
};
