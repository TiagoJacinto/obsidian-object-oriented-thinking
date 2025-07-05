/* eslint-disable sonarjs/function-return-type */
import { Component, TFile } from 'obsidian';
import { path } from 'ramda';
import { type View } from './types';
import { z } from 'zod/v4';
import type OOTPlugin from './main';
import { LiteralLinkSchema, literalLinkToLinkPath } from './main';

export class ViewsLoader extends Component {
	constructor(private readonly plugin: OOTPlugin) {
		super();
	}

	onload() {
		this.defineViews();
	}

	redefineViews() {
		delete window.oot?.views;
		this.defineViews();
	}

	private defineViews() {
		const accessorToAccessorPath = (accessor: string) => accessor.split('.').filter(Boolean);
		const accessPath = (accessor: string, obj: unknown) =>
			path(accessorToAccessorPath(accessor), obj);

		const accessorToZodSchema = (accessor: string) =>
			accessorToAccessorPath(accessor).reduceRight(
				(schema, segment) => z.object({ [segment]: schema }),
				z.string({
					error: (issue) => {
						if (issue.input === undefined)
							return `Value not found for accessor '${accessor}'. Please check the accessor path.`;

						return issue.message;
					},
				}) as z.ZodType,
			) as unknown as z.ZodObject<z.ZodRawShape>;

		const getObjectFileByPath = (path: string) => {
			const file = this.plugin.app.vault.getFileByPath(path);
			if (!file) throw new Error('File not found');
			if (!this.plugin.isObjectFile(file)) return null;
			return file;
		};

		const getObjectFileByLinkPath = (linkPath: string) => {
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, '');
			if (!file) throw new Error('File not found');
			if (!this.plugin.isObjectFile(file)) return null;
			return file;
		};

		const isPageObjectOf = (parentObjectFile: TFile, childObjectFile: TFile) => {
			const childObjectHierarchy = this.plugin.objectHierarchyByFile(childObjectFile);
			return childObjectHierarchy.includes(parentObjectFile.path);
		};

		const isPageDescendentOf = (parentObjectFile: TFile, childObjectFile: TFile) =>
			childObjectFile.path !== parentObjectFile.path &&
			isPageObjectOf(parentObjectFile, childObjectFile);

		const defineView =
			(
				ViewFilePathSchema: z.ZodPipe<
					z.ZodObject<
						Readonly<
							Record<
								string,
								z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>
							>
						>,
						z.core.$strip
					>,
					z.ZodTransform<string, Record<string, unknown>>
				>,
			) =>
			(toObjectFile: (data: unknown) => TFile | null) =>
			<T>(cb: (parentObjectFile: TFile, childFile: TFile) => T) =>
			(data: unknown, unparsedAccessedObject: unknown) => {
				const objectFile = toObjectFile(data);
				if (!objectFile) return false;

				if (unparsedAccessedObject) {
					const filePath = ViewFilePathSchema.parse(unparsedAccessedObject);
					const childObjectFile = this.plugin.objectFileByPath(filePath);
					if (!childObjectFile) return false;

					return cb(objectFile, childObjectFile);
				}
				return (unparsedAccessedObject: unknown) => {
					const filePath = ViewFilePathSchema.parse(unparsedAccessedObject);
					const childObjectFile = this.plugin.objectFileByPath(filePath);
					if (!childObjectFile) return false;

					return cb(objectFile, childObjectFile);
				};
			};

		const userDefinedViews = this.plugin.settings.views.reduce<Record<string, View>>(
			(prev, { filePathAccessor, name }) => {
				const ViewFilePathSchema = accessorToZodSchema(filePathAccessor).transform(
					(filePath) => accessPath(filePathAccessor, filePath) as string,
				);

				const getView = defineView(ViewFilePathSchema);

				const withViewFilterByFile = getView((unparsedFile) => {
					const file = z.instanceof(TFile).parse(unparsedFile);
					if (!this.plugin.isObjectFile(file)) return null;
					return file;
				});

				const withViewFilterByLiteralLink = getView((unparsedLiteralLink) => {
					const literalLink = LiteralLinkSchema.parse(unparsedLiteralLink);
					const linkPath = literalLinkToLinkPath(literalLink);

					return getObjectFileByLinkPath(linkPath);
				});

				const withViewFilterByFilePath = getView((unparsedPath) => {
					const path = z.string().parse(unparsedPath);
					return getObjectFileByPath(path);
				});

				return {
					...prev,
					[name]: {
						isObjectByFile: withViewFilterByFile(isPageObjectOf),
						isObjectByLiteralLink: withViewFilterByLiteralLink(isPageObjectOf),
						isObjectByFilePath: withViewFilterByFilePath(isPageObjectOf),

						isDescendentByFile: withViewFilterByFile(isPageDescendentOf),
						isDescendentByLiteralLink: withViewFilterByLiteralLink(isPageDescendentOf),
						isDescendentByFilePath: withViewFilterByFilePath(isPageDescendentOf),
					},
				};
			},
			{},
		);

		window.oot = {
			...window.oot!,
			views: {
				...window.oot?.views,
				...userDefinedViews,
			},
		};
	}
}
