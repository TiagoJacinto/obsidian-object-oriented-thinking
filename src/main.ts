import { type TFile, Notice, Plugin } from 'obsidian';

import { type PluginSettings, DEFAULT_SETTINGS, OOTSettingsTab } from './Settings';
import { FilesCacheService } from './FilesCache';
import { type Frontmatter } from './types';
import { toId } from './utils';
import * as time from 'date-fns';
import { FileCreationHandler } from './handlers/FileCreationHandler';
import { FileRenameHandler } from './handlers/FileRenameHandler';
import { FileChangeHandler } from './handlers/FileChangeHandler';
import { FileDeletionHandler } from './handlers/FileDeletionHandler';

const isExcalidrawFile = (file: TFile) => ExcalidrawAutomate?.isExcalidrawFile(file) ?? false;

export default class OOTPlugin extends Plugin {
	settings!: PluginSettings;
	filesCacheService!: FilesCacheService;

	async onload() {
		await this.loadSettings();

		this.filesCacheService = this.addChild(new FilesCacheService(this));

		const fileCreationHandler = new FileCreationHandler(this);

		if (this.app.workspace.layoutReady) await this.filesCacheService.initialize();
		else this.app.workspace.onLayoutReady(() => this.filesCacheService.initialize());

		this.setupEventHandlers(fileCreationHandler);

		// For hiding?
		// this.registerMarkdownPostProcessor

		this.addSettingTab(new OOTSettingsTab(this.app, this));

		window.tagOfObjectLink = async (link: `[[${string}]]`) => {
			const file = this.app.metadataCache.getFirstLinkpathDest(
				link.replaceAll('[[', '').replaceAll(']]', '').split('|')[0]!,
				'',
			);
			if (!file) throw new Error('File not found');

			const tag = this.filesCacheService.getCachedFile(file.path).objectTag;

			await this.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) => {
				this.upsertObjectTagProperty(frontmatter, tag);
			});

			return tag;
		};
	}

	setupEventHandlers(fileCreationHandler: FileCreationHandler) {
		this.registerEvent(
			this.app.vault.on('create', (file) => fileCreationHandler.execute({ file })),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) =>
				new FileRenameHandler(this).execute({ file, oldPath }),
			),
		);
		this.registerEvent(
			this.app.vault.on('modify', (file) => new FileChangeHandler(this).execute({ file })),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => new FileDeletionHandler(this).execute({ file })),
		);
	}

	async updateObjectFileTag(file: TFile) {
		const id = toId(file.path);
		this.filesCacheService.setFileId(file, id);

		await this.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) => {
			const removeExtension = () => {
				const newTag = this.settings.objectTagPrefix + id;
				this.filesCacheService.setFileCachedObjectTag(file.path, newTag);

				const parentPath = fileData.extends;
				if (parentPath) {
					this.filesCacheService.setFileExtends(file.path, null);
					this.filesCacheService.removeFileExtendedBy(parentPath, file.path);
				}
			};

			const parentFrontmatterLink = frontmatter[this.settings.superPropertyName];

			const fileData = this.filesCacheService.getCachedFile(file.path);

			if (!parentFrontmatterLink) {
				removeExtension();
				return;
			}

			const isLink =
				typeof parentFrontmatterLink === 'string' &&
				parentFrontmatterLink.startsWith('[[') &&
				parentFrontmatterLink.endsWith(']]');
			if (!isLink) {
				new Notice('Update Failed: The extended file should be a link');
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
				new Notice('Update Failed: This file should not extend itself');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const parentFile = this.app.metadataCache.getFirstLinkpathDest(parentLinkPath, '');
			if (!parentFile) {
				new Notice('Update Failed: The extended file no longer exists');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const extendsIgnoredFile = this.shouldFileBeIgnored(parentFile);
			if (extendsIgnoredFile) {
				new Notice('Update Failed: The extended file is ignored');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const parentFileData = this.filesCacheService.getCachedFile(parentFile.path);

			const hasCyclicHierarchy = parentFileData.objectTag.includes(fileData.id);
			if (hasCyclicHierarchy) {
				new Notice('Update Failed: There is a cyclic hierarchy');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const extendsHasNotChanged = fileData.extends === parentFile.path;
			if (extendsHasNotChanged) return;

			this.prependObjectTagTrail(file, parentFileData.objectTag);

			this.filesCacheService.setFileExtends(file.path, parentFile);
			this.filesCacheService.addFileExtendedBy(parentFile, file);
		});
	}

	private checkForCycle(): boolean {
		return false;
	}

	private prependObjectTagTrail(file: TFile, parentObjectTag: string) {
		const fileData = this.filesCacheService.getCachedFile(file.path);

		const oldTag = fileData.objectTag;
		this.filesCacheService.setFileCachedObjectTag(
			file.path,
			parentObjectTag + '/' + oldTag.replace(this.settings.objectTagPrefix, ''),
		);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.app.vault.getFileByPath(filePath),
		);

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			this.prependObjectTagTrail(dependentFile, parentObjectTag);
		}
	}

	private upsertObjectTagProperty(frontmatter: Frontmatter, newTag: string) {
		if (!frontmatter.tags) frontmatter.tags = [];

		const objectTags = frontmatter.tags.filter((t) => t.startsWith(this.settings.objectTagPrefix));

		if (objectTags.length > 1) {
			throw new Error('There can only be one object tag per file');
		}

		const oldTag = objectTags[0];

		if (!oldTag) {
			frontmatter.tags = [...frontmatter.tags, newTag];
			return;
		}

		if (oldTag === newTag) return;

		frontmatter.tags[frontmatter.tags.indexOf(oldTag)] = newTag;
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

	parseDate(input: string): Date | null;
	parseDate(input: number): Date;
	parseDate(input: string | number) {
		if (typeof input === 'string') {
			try {
				const parsedDate = time.parse(input, this.settings.dateFormat, new Date());

				if (isNaN(parsedDate.getTime())) return null;

				return parsedDate;
			} catch (e) {
				console.error(e);
				return null;
			}
		}
		return new Date(input);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	override async loadData() {
		return (await super.loadData()) as Promise<PluginSettings>;
	}
}
