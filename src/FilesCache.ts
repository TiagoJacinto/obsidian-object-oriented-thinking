import { type TFile, type TAbstractFile, Component, Notice } from 'obsidian';
import * as time from 'date-fns';
import type OOTPlugin from './main';
import { FileCreationHandler } from './handlers/FileCreationHandler';
import { FileDeletionHandler } from './handlers/FileDeletionHandler';
import { toId } from './utils';
import { type Frontmatter } from './types';

export class FilesCacheService extends Component {
	constructor(private readonly plugin: OOTPlugin) {
		super();
	}

	async initialize() {
		await this.synchronize();
		await this.plugin.saveSettings();
	}

	async synchronize() {
		const existingFiles = this.plugin.app.vault
			.getMarkdownFiles()
			.filter((f) => !this.plugin.shouldFileBeIgnored(f));

		const cachedFilesPath = new Set(Object.keys(this.plugin.settings.files));

		for (const existingFile of existingFiles) {
			cachedFilesPath.delete(existingFile.path);
		}

		const deletionHandler = new FileDeletionHandler(this.plugin);
		for (const deletedFilesPath of cachedFilesPath) {
			const deletedFile = this.plugin.app.vault.getAbstractFileByPath(deletedFilesPath);
			if (!deletedFile) continue;

			await deletionHandler.execute({ file: deletedFile });
		}

		const creationHandler = new FileCreationHandler(this.plugin);
		for (const existingFile of existingFiles) {
			await creationHandler.execute({ file: existingFile });
		}
	}

	isFileDataInitialized(file: TFile) {
		return !!this.plugin.settings.files[file.path];
	}

	async initializeFileData(file: TFile) {
		const id = toId(file.path);

		await this.plugin.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) => {
			const parentFrontmatterLink = frontmatter[this.plugin.settings.superPropertyName];

			if (!parentFrontmatterLink) {
				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};
				return;
			}

			const isLink =
				typeof parentFrontmatterLink === 'string' &&
				parentFrontmatterLink.startsWith('[[') &&
				parentFrontmatterLink.endsWith(']]');
			if (!isLink) {
				new Notice('Update Failed: The extended file should be a link');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};

				return;
			}

			const parentLinkPath = parentFrontmatterLink
				.replaceAll('[[', '')
				.replaceAll(']]', '')
				.split('|')[0]!;

			const extendsItself = parentLinkPath === file.basename;
			if (extendsItself) {
				new Notice('Update Failed: This file should not extend itself');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};

				return;
			}

			const parentFile = this.plugin.app.metadataCache.getFirstLinkpathDest(parentLinkPath, '');
			if (!parentFile) {
				new Notice('Update Failed: The extended file no longer exists');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};

				return;
			}

			const extendsIgnoredFile = this.plugin.shouldFileBeIgnored(parentFile);
			if (extendsIgnoredFile) {
				new Notice('Update Failed: The extended file is ignored');
				frontmatter[this.plugin.settings.superPropertyName] = null;
				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};
				return;
			}

			const parentFileData = await this.getOrInitializeFileData(parentFile);
			const hasCyclicHierarchy = parentFileData.hierarchy.includes(id);
			if (hasCyclicHierarchy) {
				new Notice('Update Failed: There is a cyclic hierarchy');
				frontmatter[this.plugin.settings.superPropertyName] = null;
				this.plugin.settings.files[file.path] = {
					id,
					hierarchy: id,
					tagged: false,
					extendedBy: [],
				};
				return;
			}

			this.plugin.settings.files[file.path] = {
				id,
				hierarchy: parentFileData.hierarchy + '/' + id,
				tagged: false,
				extends: parentFile.path,
				extendedBy: [],
			};

			this.plugin.filesCacheService.addFileExtendedBy(parentFile, file);
		});
	}

	private async getOrInitializeFileData(file: TFile) {
		if (this.isFileDataInitialized(file)) return this.plugin.settings.files[file.path]!;

		await this.initializeFileData(file);
		return this.plugin.settings.files[file.path]!;
	}

	getInitializedFileData(path: string) {
		const result = this.plugin.settings.files[path];
		if (!result) throw new Error(`File data of ${path} not found`);
		return result;
	}

	tagFile({ path }: TFile) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			tagged: true,
		};
	}

	setFileUpdatedAt({ path }: TAbstractFile) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			updatedAt: this.formatDate(new Date()),
		};
	}

	setFileExtends(path: string, extendsFile: TFile | null) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extends: extendsFile?.path,
		};
	}

	updateFileExtendedBy(path: string, previousPath: string, newPath: string) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.map((f) => (f === previousPath ? newPath : f)),
		};
	}

	addFileExtendedBy({ path }: TAbstractFile, extendedBy: TFile) {
		const fileData = this.getInitializedFileData(path);

		const exists = fileData.extendedBy.includes(extendedBy.path);
		if (exists) return;

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: [...fileData.extendedBy, extendedBy.path],
		};
	}

	removeFileExtendedBy(path: string, extendedByPath: string) {
		const fileData = this.getInitializedFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.filter((f) => f !== extendedByPath),
		};
	}

	setFileHierarchy(path: string, hierarchy: string) {
		const fileData = this.getInitializedFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			hierarchy,
		};
	}

	setFileId({ path }: TAbstractFile, id: string) {
		const fileData = this.getInitializedFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			id,
		};
	}

	private formatDate(input: Date) {
		return time.format(input, this.plugin.settings.dateFormat);
	}
}
