import { Notice, Plugin, type TFile } from 'obsidian';

import {
	type PluginSettings,
	DEFAULT_SETTINGS,
	OOTSettingsTab,
	PluginSettingsSchema,
} from './Settings';
import { FilesCacheService } from './FilesCache';
import { type ObjectFile, type Frontmatter } from './types';
import { FileCreationHandler } from './handlers/FileCreationHandler';
import { FileRenameHandler } from './handlers/FileRenameHandler';
import { FileChangeHandler } from './handlers/FileChangeHandler';
import { FileDeletionHandler } from './handlers/FileDeletionHandler';
import { dissocPath } from 'ramda';
import { z } from 'zod/v4';

const isExcalidrawFile = (file: TFile) => ExcalidrawAutomate?.isExcalidrawFile(file) ?? false;

export default class OOTPlugin extends Plugin {
	settings!: PluginSettings;
	filesCacheService!: FilesCacheService;

	fileCreationHandler!: FileCreationHandler;
	fileRenameHandler!: FileRenameHandler;
	fileChangeHandler!: FileChangeHandler;
	fileDeletionHandler!: FileDeletionHandler;

	async onload() {
		await this.loadSettings();

		this.fileCreationHandler = new FileCreationHandler(this);
		this.fileRenameHandler = new FileRenameHandler(this);
		this.fileChangeHandler = new FileChangeHandler(this);
		this.fileDeletionHandler = new FileDeletionHandler(this);

		this.filesCacheService = this.addChild(new FilesCacheService(this));

		this.app.workspace.onLayoutReady(async () => {
			await this.filesCacheService.initialize();
		});

		this.setupEventHandlers();

		this.addSettingTab(new OOTSettingsTab(this.app, this));

		window.oot = {
			getObjectFileByPath: (unparsedPath) => {
				const path = z.string().parse(unparsedPath);
				const file = this.app.vault.getFileByPath(path);
				if (!file || !this.isObjectFile(file)) return null;
				return this.toObjectFile(file);
			},
			getObjectFileByLink: (unparsedLink) => {
				const linkpath = z
					.string('Must be a literal link in the format [[Link]]')
					.regex(/^\[\[.*\]\]$/, 'Must be a literal link in the format [[Link]]')
					.and(z.custom<`[[${string}]]`>())
					.parse(unparsedLink)
					.replaceAll('[[', '')
					.replaceAll(']]', '')
					.split('|')[0]!;

				const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, '');
				if (!file || !this.isObjectFile(file)) return null;

				return this.toObjectFile(file);
			},
		};
	}

	unload() {
		delete window.oot;
	}

	isObjectFile(file: TFile) {
		return !this.shouldFileBeIgnored(file);
	}

	toObjectFile(file: TFile): ObjectFile {
		return {
			...file,
			isDescendantOf: (unparsedParentFile) => {
				const parentFile = z.object({ path: z.string() }).parse(unparsedParentFile);
				const childFileData = this.filesCacheService.getInitializedFileData(file.path);
				const childHierarchy = childFileData.hierarchy;

				return file.path !== parentFile.path && childHierarchy.includes(parentFile.path);
			},
		};
	}

	setupEventHandlers() {
		this.registerEvent(
			this.app.vault.on('create', (file) => this.fileCreationHandler.execute({ file })),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) =>
				this.fileRenameHandler.execute({ file, oldPath }),
			),
		);
		this.registerEvent(
			this.app.vault.on('modify', (file) => this.fileChangeHandler.execute({ file })),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => this.fileDeletionHandler.execute({ file })),
		);
	}

	async updateObjectFileHierarchy(file: TFile) {
		const fileData = this.filesCacheService.getInitializedFileData(file.path);

		await this.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) => {
			const removeExtension = () => {
				this.filesCacheService.setFileHierarchy(file.path, [file.path]);

				const parentPath = fileData.extends;
				if (parentPath) {
					this.filesCacheService.setFileExtends(file.path, null);
					this.filesCacheService.removeFileExtendedBy(parentPath, file.path);
				}
			};

			const parentFrontmatterLink = frontmatter[this.settings.superPropertyName];

			if (!parentFrontmatterLink) {
				removeExtension();
				return;
			}

			const isLink =
				typeof parentFrontmatterLink === 'string' &&
				parentFrontmatterLink.startsWith('[[') &&
				parentFrontmatterLink.endsWith(']]');
			if (!isLink) {
				new Notice('Update failed: the extended file should be a link');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const parentLinkPath = parentFrontmatterLink
				.replaceAll('[[', '')
				.replaceAll(']]', '')
				.split('|')[0]!;

			const extendsItself = parentLinkPath === file.basename;
			if (extendsItself) {
				new Notice('Update failed: this file should not extend itself');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const parentFile = this.app.metadataCache.getFirstLinkpathDest(parentLinkPath, file.path);
			if (!parentFile) {
				new Notice('Update failed: the extended file no longer exists');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const extendsIgnoredFile = this.shouldFileBeIgnored(parentFile);
			if (extendsIgnoredFile) {
				new Notice('Update failed: the extended file is ignored');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const parentFileData = this.filesCacheService.getInitializedFileData(parentFile.path);

			const hasCyclicHierarchy = parentFileData.hierarchy.includes(file.path);
			if (hasCyclicHierarchy) {
				new Notice('Update failed: there is a cyclic hierarchy');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const oldParentPath = fileData.extends;
			if (oldParentPath) {
				const extendsHasChanged = oldParentPath !== parentFile.path;
				if (!extendsHasChanged) return;

				this.filesCacheService.removeFileExtendedBy(oldParentPath, file.path);
			}

			this.filesCacheService.addFileExtendedBy(parentFile, file);

			await this.addObjectPrefixToHierarchy(file, parentFileData.hierarchy);

			this.filesCacheService.setFileExtends(file.path, parentFile);
		});

		await this.saveSettings();
	}

	private async addObjectPrefixToHierarchy(file: TFile, parentHierarchy: string[]) {
		const fileData = this.filesCacheService.getInitializedFileData(file.path);

		const newHierarchy = [...parentHierarchy, file.path];

		this.filesCacheService.setFileHierarchy(file.path, newHierarchy);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.app.vault.getFileByPath(filePath),
		);

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			await this.addObjectPrefixToHierarchy(dependentFile, newHierarchy);
		}
	}

	shouldFileBeIgnored(file: TFile) {
		if (
			!file.path ||
			file.extension !== 'md' ||
			// Canvas files are created as 'Canvas.md',
			// so the plugin will update "frontmatter" and break the file when it gets created
			file.name === 'Canvas.md' ||
			isExcalidrawFile(file)
		) {
			return true;
		}

		return this.settings.ignoredFolders.some((ignoredFolderPath) =>
			file.path.startsWith(ignoredFolderPath),
		);
	}

	toExistingFiles(paths: string[]) {
		return paths.map((p) => this.app.vault.getFileByPath(p)).filter(Boolean);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	override async loadData() {
		let data = ((await super.loadData()) as object) ?? {};

		const result = PluginSettingsSchema.partial().safeParse(data);
		if (result.success) return result.data;

		for (const issue of result.error.issues) {
			const isFileDataIssue = issue.code === 'invalid_type' && issue.path[0] === 'files';

			if (isFileDataIssue) {
				// remove file from data so that it can be recreated
				data = dissocPath(
					issue.path.slice(0, 2).filter((p) => typeof p !== 'symbol'),
					data,
				);
			}
		}

		data = PluginSettingsSchema.partial().parse(data);

		await this.saveData(data);
		return data;
	}
}
