import { type TFile, Notice, Plugin } from 'obsidian';

import {
	type PluginSettings,
	DEFAULT_SETTINGS,
	OOTSettingsTab,
	PluginSettingsSchema,
} from './Settings';
import { FilesCacheService } from './FilesCache';
import { type Frontmatter } from './types';
import { FileCreationHandler } from './handlers/FileCreationHandler';
import { FileRenameHandler } from './handlers/FileRenameHandler';
import { FileChangeHandler } from './handlers/FileChangeHandler';
import { FileDeletionHandler } from './handlers/FileDeletionHandler';
import { dissocPath } from 'ramda';

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

		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (
					mutation.type === 'childList' &&
					mutation.addedNodes.length > 0 &&
					mutation.target instanceof HTMLElement
				) {
					const objectTagElements = mutation.target
						.findAll('.metadata-property[data-property-key="tags"] .multi-select-pill')
						.filter((e) => e.textContent?.startsWith(this.settings.objectTagPrefix));

					objectTagElements.forEach((e) => {
						if (this.settings.hideObjectTag) e.classList.add('hidden');
						else e.classList.remove('hidden');
					});
				}
			});
		});

		const targetNode = this.app.workspace.containerEl;
		observer.observe(targetNode, { childList: true, subtree: true });
		this.register(() => observer.disconnect());

		this.fileCreationHandler = new FileCreationHandler(this);
		this.fileRenameHandler = new FileRenameHandler(this);
		this.fileChangeHandler = new FileChangeHandler(this);
		this.fileDeletionHandler = new FileDeletionHandler(this);

		this.filesCacheService = this.addChild(new FilesCacheService(this));

		if (this.app.workspace.layoutReady) await this.filesCacheService.initialize();
		else this.app.workspace.onLayoutReady(() => this.filesCacheService.initialize());

		this.setupEventHandlers();

		// For hiding?
		// this.registerMarkdownPostProcessor

		this.addSettingTab(new OOTSettingsTab(this.app, this));

		window.tagOfObjectLink = async (link: `[[${string}]]`) => {
			const file = this.app.metadataCache.getFirstLinkpathDest(
				link.replaceAll('[[', '').replaceAll(']]', '').split('|')[0]!,
				'',
			);
			if (!file) throw new Error('File not found');

			const tag =
				this.settings.objectTagPrefix +
				this.filesCacheService.getInitializedFileData(file.path).hierarchy;

			await this.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) =>
				this.upsertObjectTagProperty(frontmatter, tag),
			);

			this.filesCacheService.tagFile(file);

			return tag;
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
				this.filesCacheService.setFileHierarchy(file.path, fileData.id);

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

			const parentFileData = this.filesCacheService.getInitializedFileData(parentFile.path);

			const hasCyclicHierarchy = parentFileData.hierarchy.includes(fileData.id);
			if (hasCyclicHierarchy) {
				new Notice('Update Failed: There is a cyclic hierarchy');
				frontmatter[this.settings.superPropertyName] = null;
				removeExtension();
				return;
			}

			const extendsHasNotChanged = fileData.extends === parentFile.path;
			if (extendsHasNotChanged) return;

			await this.prependObjectTagTrail(file, parentFileData.hierarchy);

			this.filesCacheService.setFileExtends(file.path, parentFile);
			this.filesCacheService.addFileExtendedBy(parentFile, file);
		});
	}

	private async prependObjectTagTrail(file: TFile, parentObjectTag: string) {
		const fileData = this.filesCacheService.getInitializedFileData(file.path);

		const oldTag = fileData.hierarchy;
		this.filesCacheService.setFileHierarchy(file.path, parentObjectTag + '/' + oldTag);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.app.vault.getFileByPath(filePath),
		);

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			await this.prependObjectTagTrail(dependentFile, parentObjectTag);
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

	toExistingFiles(paths: string[]) {
		return paths.map((p) => this.app.vault.getAbstractFileByPath(p)).filter(Boolean);
	}

	onunload() {}

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
				data = dissocPath(issue.path.slice(0, 2), data);
			}
		}

		data = PluginSettingsSchema.partial().parse(data);

		await this.saveData(data);
		return data;
	}
}
