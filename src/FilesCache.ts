import { type TFile, type TAbstractFile, Component, Notice } from 'obsidian';
import type OOTPlugin from './main';
import { formatDate, parseDate } from './utils';
import { type Frontmatter } from './types';
import * as time from 'date-fns';

export class FilesCacheService extends Component {
	constructor(private readonly plugin: OOTPlugin) {
		super();
	}

	async initialize() {
		await this.synchronize();
	}

	async synchronize() {
		const existingFiles = this.plugin.app.vault.getMarkdownFiles();

		for (const existingFile of existingFiles) {
			await this.plugin.fileCreationHandler.execute({ file: existingFile });
		}

		for (const filePath of Object.keys(this.plugin.settings.files)) {
			const file = existingFiles.find((f) => f.path === filePath);
			if (!file || this.shouldFileDataBeDeleted(file)) {
				await this.plugin.fileDeletionHandler.impl(filePath);
			}
		}
	}

	shouldFileDataBeDeleted({ path }: TFile) {
		if (!this.fileDataExists(path)) return false;

		const { softExcludedAt } = this.getInitializedFileData(path);
		if (!softExcludedAt) return false;

		const fileSoftExcludedAt = parseDate(softExcludedAt);
		if (!fileSoftExcludedAt) return false;

		const currentTime = new Date();
		const exclusionDate = time.add(fileSoftExcludedAt, {
			minutes: this.plugin.settings.minSoftExclusionDays * 24 * 60,
		});

		return time.isAfter(currentTime, exclusionDate);
	}

	fileDataExists(path: string) {
		return !!this.plugin.settings.files[path];
	}

	async initializeFileData(file: TFile) {
		await this.plugin.app.fileManager.processFrontMatter(file, async (frontmatter: Frontmatter) => {
			const parentFrontmatterLink = frontmatter[this.plugin.settings.superPropertyName];

			if (!parentFrontmatterLink) {
				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],
					extendedBy: [],
				};
				return;
			}

			const isLink =
				typeof parentFrontmatterLink === 'string' &&
				parentFrontmatterLink.startsWith('[[') &&
				parentFrontmatterLink.endsWith(']]');
			if (!isLink) {
				new Notice('Update failed: the extended file should be a link');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],
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
				new Notice('Update failed: this file should not extend itself');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],

					extendedBy: [],
				};

				return;
			}

			const parentFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				parentLinkPath,
				file.path,
			);
			if (!parentFile) {
				new Notice('Update failed: the extended file no longer exists');
				frontmatter[this.plugin.settings.superPropertyName] = null;

				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],

					extendedBy: [],
				};

				return;
			}

			const extendsIgnoredFile = this.plugin.shouldFileBeIgnored(parentFile);
			if (extendsIgnoredFile) {
				new Notice('Update failed: the extended file is ignored');
				frontmatter[this.plugin.settings.superPropertyName] = null;
				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],

					extendedBy: [],
				};
				return;
			}

			const parentFileData = await this.getOrInitializeFileData(parentFile);
			const hasCyclicHierarchy = parentFileData.hierarchy.includes(file.path);
			if (hasCyclicHierarchy) {
				new Notice('Update failed: there is a cyclic hierarchy');
				frontmatter[this.plugin.settings.superPropertyName] = null;
				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],

					extendedBy: [],
				};
				return;
			}

			this.plugin.settings.files[file.path] = {
				hierarchy: [...parentFileData.hierarchy, file.path],

				extends: parentFile.path,
				extendedBy: [],
			};

			this.plugin.filesCacheService.addFileExtendedBy(parentFile, file);
		});
	}

	private async getOrInitializeFileData(file: TFile) {
		if (this.fileDataExists(file.path)) return this.plugin.settings.files[file.path]!;

		await this.initializeFileData(file);
		return this.plugin.settings.files[file.path]!;
	}

	getInitializedFileData(path: string) {
		const result = this.plugin.settings.files[path];
		if (!result) throw new Error(`File data of ${path} not found`);
		return result;
	}

	setFileUpdatedAt({ path }: TAbstractFile) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			updatedAt: formatDate(new Date()),
		};
	}

	includeFile(path: string) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			softExcludedAt: undefined,
		};
	}

	setFileSoftExcludedAt(path: string) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			softExcludedAt: formatDate(new Date()),
		};
	}

	setFileExtends(path: string, extendsFile: TFile | null) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extends: extendsFile?.path,
		};
	}

	updateFileExtendedBy(path: string, oldPath: string, newPath: string) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.map((f) => (f === oldPath ? newPath : f)),
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

	updateHierarchyPath(path: string, oldPath: string, newPath: string) {
		const fileData = this.getInitializedFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			hierarchy: fileData.hierarchy.map((p) => (p === oldPath ? newPath : p)),
		};
	}

	setFileHierarchy(path: string, hierarchy: string[]) {
		const fileData = this.getInitializedFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			hierarchy,
		};
	}
}
