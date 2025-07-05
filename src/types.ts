export type Frontmatter = {
	[key: string]: unknown;

	tags?: string[];
};

export type ObjectFile = {
	isObjectOf: (unparsedFile: unknown) => boolean;
	isDescendentOf: (unparsedParentFile: unknown) => boolean;
};

export type View = {
	isObjectByFile: (
		unparsedFile: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);
	isObjectByLiteralLink: (
		unparsedLiteralLink: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);
	isObjectByFilePath: (
		unparsedFilePath: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);

	isDescendentByFile: (
		unparsedFile: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);
	isDescendentByLiteralLink: (
		unparsedLiteralLink: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);
	isDescendentByFilePath: (
		unparsedFilePath: unknown,
		unparsedAccessedObject: unknown,
	) => boolean | ((unparsedAccessedObject: unknown) => boolean);
};
