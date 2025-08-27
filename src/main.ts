/* eslint-disable sonarjs/cognitive-complexity */
import {
	MarkdownView,
	Notice,
	Plugin,
	type TFile,
	type WorkspaceLeaf,
} from "obsidian";
import { dissocPath } from "ramda";
import { z } from "zod/v4";
import { FilesCacheService } from "./FilesCache";
import { FileChangeHandler } from "./handlers/FileChangeHandler";
import { FileCreationHandler } from "./handlers/FileCreationHandler";
import { FileDeletionHandler } from "./handlers/FileDeletionHandler";
import { FileRenameHandler } from "./handlers/FileRenameHandler";
import {
	DEFAULT_SETTINGS,
	type ErrorToBeSolved,
	OOTSettingsTab,
	type PluginSettings,
	PluginSettingsSchema,
} from "./Settings";
import type { Frontmatter, ObjectFile } from "./types";
import {
	INHERITANCE_ERROR_VIEW_TYPE,
	InheritanceErrorsView,
} from "./views/InheritanceErrorsView";

const isExcalidrawFile = (file: TFile) =>
	typeof ExcalidrawAutomate !== "undefined"
		? ExcalidrawAutomate.isExcalidrawFile(file)
		: false;

export default class OOTPlugin extends Plugin {
	readonly ERROR_NOTICE = {
		"!isLink": "Update failed: the extended file should be a link",
		extendsItself: "Update failed: this file should not extend itself",
		"!parentFile": "Update failed: the extended file no longer exists",
		extendsIgnoredFile: "Update failed: the extended file is ignored",
		hasCyclicHierarchy: "Update failed: there is a cyclic hierarchy",
	};

	settings!: PluginSettings;
	filesCacheService!: FilesCacheService;
	inheritanceErrorsView?: InheritanceErrorsView;

	fileCreationHandler!: FileCreationHandler;
	fileRenameHandler!: FileRenameHandler;
	fileChangeHandler!: FileChangeHandler;
	fileDeletionHandler!: FileDeletionHandler;

	async createView() {
		let leaf: WorkspaceLeaf | undefined | null;
		const leaves = this.app.workspace.getLeavesOfType(
			INHERITANCE_ERROR_VIEW_TYPE,
		);

		const leafAlreadyExists = leaves.length > 0;
		if (leafAlreadyExists) {
			const alreadyExistentLeaf = leaves[0];
			leaf = alreadyExistentLeaf;
		} else {
			leaf = this.app.workspace.getLeftLeaf(false);
			await leaf?.setViewState({
				type: INHERITANCE_ERROR_VIEW_TYPE,
				active: true,
			});
		}

		return leaf;
	}

	async activateView() {
		const leaf = await this.createView();
		if (!leaf) return;

		await this.app.workspace.revealLeaf(leaf);
	}

	logError(errorToBeSolved: NonNullable<ErrorToBeSolved>) {
		new Notice(this.ERROR_NOTICE[errorToBeSolved]);
	}

	async onload() {
		await this.loadSettings();

		this.fileCreationHandler = new FileCreationHandler(this);
		this.fileRenameHandler = new FileRenameHandler(this);
		this.fileChangeHandler = new FileChangeHandler(this);
		this.fileDeletionHandler = new FileDeletionHandler(this);

		this.filesCacheService = this.addChild(new FilesCacheService(this));

		this.app.workspace.onLayoutReady(async () => {
			await this.filesCacheService.initialize();

			await this.createView();
		});

		this.registerView(INHERITANCE_ERROR_VIEW_TYPE, (leaf) => {
			this.inheritanceErrorsView = new InheritanceErrorsView(leaf, this);
			return this.inheritanceErrorsView;
		});

		this.addCommand({
			id: "show-inheritance-errors",
			name: "Show inheritance errors",
			callback: () => this.activateView(),
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return;

				const inheritanceMetadataPropertyValue =
					this.getInheritanceMetadataPropertyValue();
				if (!inheritanceMetadataPropertyValue) return;

				const errorToBeSolved =
					await this.filesCacheService.getFileErrorToBeSolved(file.path);
				if (!errorToBeSolved) {
					this.removeInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
						inheritanceMetadataPropertyValue,
					);
					return;
				}

				this.addInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
					inheritanceMetadataPropertyValue,
				);
				this.logError(errorToBeSolved);
			}),
		);

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
					.string("Must be a literal link in the format [[Link]]")
					.regex(
						/^\[\[.*\]\]$/,
						"Must be a literal link in the format [[Link]]",
					)
					.and(z.custom<`[[${string}]]`>())
					.parse(unparsedLink)
					.replaceAll("[[", "")
					.replaceAll("]]", "")
					.split("|")[0]!;

				const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, "");
				if (!file || !this.isObjectFile(file)) return null;

				return this.toObjectFile(file);
			},
		};
	}

	onunload() {
		delete window.oot;
	}

	removeInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
		inheritanceMetadataPropertyValue: Element,
	) {
		inheritanceMetadataPropertyValue.classList.remove(
			"invalid-parent-extension",
		);
	}

	addInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
		inheritanceMetadataPropertyValue: Element,
	) {
		inheritanceMetadataPropertyValue.classList.add("invalid-parent-extension");
	}

	getInheritanceMetadataPropertyValue() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return;

		return Array.from(
			activeView.contentEl.querySelectorAll(".metadata-property"),
		)
			.find((prop) => {
				const inputElement = prop.querySelector(".metadata-property-key-input");

				return (
					inputElement &&
					"value" in inputElement &&
					inputElement.value === this.settings.superPropertyName
				);
			})
			?.querySelector(".metadata-property-value");
	}

	isObjectFile(file: TFile) {
		return !this.shouldFileBeIgnored(file);
	}

	toObjectFile(file: TFile): ObjectFile {
		return {
			...file,
			isDescendantOf: (unparsedParentFile) => {
				const parentFile = z
					.object({ path: z.string() })
					.parse(unparsedParentFile);

				void this.filesCacheService.initializeFileData(file);

				const childFileData =
					this.filesCacheService.getInitializedFileData(file);

				if (!childFileData) {
					// eslint-disable-next-line sonarjs/void-use
					void this.app.workspace
						.getActiveViewOfType(MarkdownView)
						?.leaf.rebuildView();
					throw new Error(`File data of ${file.path} not found`);
				}

				const childHierarchy = childFileData.hierarchy;

				return (
					file.path !== parentFile.path &&
					childHierarchy.includes(parentFile.path)
				);
			},
		};
	}

	setupEventHandlers() {
		this.registerEvent(
			this.app.vault.on("create", (file) =>
				this.fileCreationHandler.execute({ file }),
			),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) =>
				this.fileRenameHandler.execute({ file, oldPath }),
			),
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) =>
				this.fileChangeHandler.execute({ file }),
			),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) =>
				this.fileDeletionHandler.execute({ file }),
			),
		);
	}

	async processObjectFileHierarchy({
		file,
		onInvalid,
		onSuccess,
	}: {
		file: TFile;
		onInvalid: (errorToBeSolved?: ErrorToBeSolved) => Promise<void>;
		onSuccess?: (parentFile: TFile) => Promise<void>;
	}) {
		const isActiveFile = () => this.app.workspace.getActiveFile() === file;

		await this.app.fileManager.processFrontMatter(
			file,
			async (frontmatter: Frontmatter) => {
				const parentFrontmatterLink =
					frontmatter[this.settings.superPropertyName];

				if (!parentFrontmatterLink) {
					await onInvalid();
					return;
				}

				const isLink =
					typeof parentFrontmatterLink === "string" &&
					parentFrontmatterLink.startsWith("[[") &&
					parentFrontmatterLink.endsWith("]]");
				if (!isLink) {
					if (isActiveFile()) this.logError("!isLink");

					await onInvalid("!isLink");
					return;
				}

				const parentLinkPath = parentFrontmatterLink
					.replaceAll("[[", "")
					.replaceAll("]]", "")
					.split("|")[0]!;

				const extendsItself = parentLinkPath === file.basename;
				if (extendsItself) {
					if (isActiveFile()) this.logError("extendsItself");

					await onInvalid("extendsItself");
					return;
				}

				const parentFile = this.app.metadataCache.getFirstLinkpathDest(
					parentLinkPath,
					file.path,
				);
				if (!parentFile) {
					if (isActiveFile()) this.logError("!parentFile");

					await onInvalid("!parentFile");
					return;
				}

				const extendsIgnoredFile = this.shouldFileBeIgnored(parentFile);
				if (extendsIgnoredFile) {
					if (isActiveFile()) this.logError("extendsIgnoredFile");

					await onInvalid("extendsIgnoredFile");
					return;
				}

				const parentFileData =
					await this.filesCacheService.getOrInitializeFileData(parentFile.path);

				const hasCyclicHierarchy = parentFileData.hierarchy.includes(file.path);
				if (hasCyclicHierarchy) {
					if (isActiveFile()) this.logError("hasCyclicHierarchy");

					await onInvalid("hasCyclicHierarchy");
					return;
				}

				await onSuccess?.(parentFile);

				await this.filesCacheService.addFileExtendedBy(parentFile, file);
				await this.addObjectPrefixToHierarchy(file, parentFileData.hierarchy);
				await this.filesCacheService.setFileExtends(file.path, parentFile);
				await this.filesCacheService.removeFileErrorToBeSolved(file);

				await this.saveSettings();
			},
		);
	}

	async updateObjectFileHierarchy(file: TFile) {
		const fileData = await this.filesCacheService.getOrInitializeFileData(
			file.path,
		);

		return this.processObjectFileHierarchy({
			file,
			onInvalid: async (errorToBeSolved) => {
				await this.filesCacheService.setFileHierarchy(file.path, [file.path]);
				await this.filesCacheService.setFileErrorToBeSolved(
					file.path,
					errorToBeSolved,
				);

				const parentPath = fileData.extends;
				if (parentPath) {
					await this.filesCacheService.setFileExtends(file.path, null);
					await this.filesCacheService.removeFileExtendedBy(
						parentPath,
						file.path,
					);
				}
				await this.saveSettings();

				const inheritanceMetadataPropertyValue =
					this.getInheritanceMetadataPropertyValue();
				if (!inheritanceMetadataPropertyValue) return;

				this.addInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
					inheritanceMetadataPropertyValue,
				);
			},
			onSuccess: async (parentFile) => {
				const inheritanceMetadataPropertyValue =
					this.getInheritanceMetadataPropertyValue();
				if (!inheritanceMetadataPropertyValue) return;

				this.removeInvalidParentExtensionClassToInheritanceMetadataPropertyValue(
					inheritanceMetadataPropertyValue,
				);

				const oldParentPath = fileData.extends;
				if (oldParentPath) {
					const extendsHasChanged = oldParentPath !== parentFile.path;
					if (!extendsHasChanged) return;

					await this.filesCacheService.removeFileExtendedBy(
						oldParentPath,
						file.path,
					);
				}
			},
		});
	}

	private async addObjectPrefixToHierarchy(
		file: TFile,
		parentHierarchy: string[],
	) {
		const fileData = await this.filesCacheService.getOrInitializeFileData(
			file.path,
		);

		const newHierarchy = [...parentHierarchy, file.path];

		await this.filesCacheService.setFileHierarchy(file.path, newHierarchy);

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
			file.extension !== "md" ||
			// Canvas files are created as 'Canvas.md',
			// so the plugin will update "frontmatter" and break the file when it gets created
			file.name === "Canvas.md" ||
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
		this.inheritanceErrorsView?.render();
	}

	override async loadData() {
		let data = ((await super.loadData()) as object) ?? {};

		const result = PluginSettingsSchema.partial().safeParse(data);
		if (result.success) return result.data;

		for (const issue of result.error.issues) {
			const isFileDataIssue =
				issue.code === "invalid_type" && issue.path[0] === "files";

			if (isFileDataIssue) {
				// remove file from data so that it can be recreated
				data = dissocPath(
					issue.path.slice(0, 2).filter((p) => typeof p !== "symbol"),
					data,
				);
			}
		}

		data = PluginSettingsSchema.partial().parse(data);

		await this.saveData(data);
		return data;
	}
}
