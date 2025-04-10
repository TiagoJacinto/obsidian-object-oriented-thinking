import { type TFile, type TAbstractFile, Component } from 'obsidian';
import { type CachedFile } from './Settings';
import * as time from 'date-fns';
import { toId } from './utils';
import type OOTPlugin from './main';
import { FileCreationHandler } from './handlers/FileCreationHandler';
import { FileDeletionHandler } from './handlers/FileDeletionHandler';

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
			await deletionHandler.impl(deletedFilesPath);
		}

		const creationHandler = new FileCreationHandler(this.plugin);
		for (const existingFile of existingFiles) {
			await creationHandler.execute({ file: existingFile });
		}
	}

	getCachedFile(path: string) {
		const fileData = this.plugin.settings.files[path];
		const id = toId(path);

		const newFileData: CachedFile = {
			id: fileData?.id ?? id,
			extends: fileData?.extends,
			extendedBy: fileData?.extendedBy ?? [],
			objectTag: fileData?.objectTag ?? this.plugin.settings.objectTagPrefix + id,
			updatedAt: fileData?.updatedAt,
		};

		this.plugin.settings.files[path] = newFileData;

		return newFileData;
	}

	setFileUpdatedAt({ path }: TAbstractFile) {
		const fileData = this.getCachedFile(path);

		this.plugin.settings.files[path] = {
			...fileData,
			updatedAt: this.formatDate(new Date()),
		};
	}

	setFileExtends(path: string, extendsFile: TFile | null) {
		const fileData = this.getCachedFile(path);
		this.plugin.settings.files[path] = {
			...fileData,
			extends: extendsFile?.path,
		};
	}

	updateFileExtendedBy(path: string, previousPath: string, newPath: string) {
		const fileData = this.getCachedFile(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.map((f) => (f === previousPath ? newPath : f)),
		};
	}

	addFileExtendedBy({ path }: TAbstractFile, extendedBy: TFile) {
		const fileData = this.getCachedFile(path);
		const exists = fileData.extendedBy.includes(extendedBy.path);
		if (exists) return;

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: [...fileData.extendedBy, extendedBy.path],
		};
	}

	removeFileExtendedBy(path: string, extendedByPath: string) {
		const fileData = this.getCachedFile(path);
		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.filter((f) => f !== extendedByPath),
		};
	}

	setFileCachedObjectTag(path: string, objectTag: string) {
		const fileData = this.getCachedFile(path);
		this.plugin.settings.files[path] = {
			...fileData,
			objectTag,
		};
	}

	setFileId({ path }: TAbstractFile, id: string) {
		const fileData = this.getCachedFile(path);
		this.plugin.settings.files[path] = {
			...fileData,
			id,
		};
	}

	private formatDate(input: Date) {
		return time.format(input, this.plugin.settings.dateFormat);
	}
}
