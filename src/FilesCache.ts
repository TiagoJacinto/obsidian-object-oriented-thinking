import * as time from "date-fns";
import { Component, type TFile } from "obsidian";
import type OOTPlugin from "./main";
import { type ErrorToBeSolved } from "./Settings";
import { formatDate, parseDate } from "./utils";

function raise(thrown: unknown): never {
	throw thrown;
}

export class FilesCacheService extends Component {
	constructor(private readonly plugin: OOTPlugin) {
		super();
	}

	async initialize() {
		await this.synchronize();
	}

	async synchronize() {
		const existingFiles = this.plugin.app.vault.getMarkdownFiles().reduce(
			(obj, file) => {
				obj[file.path] = file;
				return obj;
			},
			{} as Record<string, TFile>,
		);

		for (const existingFile of Object.values(existingFiles)) {
			await this.plugin.fileCreationHandler.execute({ file: existingFile });
		}

		for (const filePath of Object.keys(this.plugin.settings.files)) {
			const file = existingFiles[filePath];
			if (!file || (await this.shouldFileDataBeDeleted(file))) {
				await this.plugin.fileDeletionHandler.impl(filePath);
			}
		}
	}

	async shouldFileDataBeDeleted(file: TFile) {
		if (!this.fileDataExists(file.path)) return false;

		const { softExcludedAt } = await this.getOrInitializeFileData(file);
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
		await this.plugin.processObjectFileHierarchy({
			file,
			onInvalid: async (errorToBeSolved) => {
				this.plugin.settings.files[file.path] = {
					hierarchy: [file.path],
					extendedBy: [],
					errorToBeSolved,
				};

				await this.plugin.saveSettings();
			},
		});
	}

	async getFileErrorToBeSolved(path: string) {
		const fileData = await this.getOrInitializeFileData(path);
		return fileData.errorToBeSolved;
	}

	async getOrInitializeFileData(pathOrFile: string | TFile) {
		const file = this.pathOrFileToFile(pathOrFile);

		const result = this.plugin.settings.files[file.path];
		if (!result) await this.initializeFileData(file);
		return result!;
	}

	getInitializedFileData(pathOrFile: string | TFile) {
		const file = this.pathOrFileToFile(pathOrFile);

		return this.plugin.settings.files[file.path];
	}

	private pathOrFileToFile(pathOrFile: string | TFile) {
		return typeof pathOrFile === "string"
			? (this.plugin.app.vault.getFileByPath(pathOrFile) ?? raise(1))
			: pathOrFile;
	}

	async setFileUpdatedAt(file: TFile) {
		const fileData = await this.getOrInitializeFileData(file);

		this.plugin.settings.files[file.path] = {
			...fileData,
			updatedAt: formatDate(new Date()),
		};
	}

	async setFileErrorToBeSolved(path: string, errorToBeSolved: ErrorToBeSolved) {
		const fileData = await this.getOrInitializeFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			errorToBeSolved,
		};
	}

	async removeFileErrorToBeSolved({ path }: TFile) {
		if (!(path in this.plugin.settings.files))
			throw new Error(`File data of ${path} not found`);

		delete this.plugin.settings.files[path]!.errorToBeSolved;
	}

	async includeFile(path: string) {
		const fileData = await this.getOrInitializeFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			softExcludedAt: undefined,
		};
	}

	async setFileSoftExcludedAt(path: string) {
		const fileData = await this.getOrInitializeFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			softExcludedAt: formatDate(new Date()),
		};
	}

	async setFileExtends(path: string, extendsFile: TFile | null) {
		const fileData = await this.getOrInitializeFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extends: extendsFile?.path,
		};
	}

	async updateFileExtendedBy(path: string, oldPath: string, newPath: string) {
		const fileData = await this.getOrInitializeFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.map((f) => (f === oldPath ? newPath : f)),
		};
	}

	async addFileExtendedBy({ path }: TFile, extendedBy: TFile) {
		const fileData = await this.getOrInitializeFileData(path);

		const exists = fileData.extendedBy.includes(extendedBy.path);
		if (exists) return;

		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: [...fileData.extendedBy, extendedBy.path],
		};
	}

	async removeFileExtendedBy(path: string, extendedByPath: string) {
		const fileData = await this.getOrInitializeFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			extendedBy: fileData.extendedBy.filter((f) => f !== extendedByPath),
		};
	}

	async updateHierarchyPath(path: string, oldPath: string, newPath: string) {
		const fileData = await this.getOrInitializeFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			hierarchy: fileData.hierarchy.map((p) => (p === oldPath ? newPath : p)),
		};
	}

	async setFileHierarchy(path: string, hierarchy: string[]) {
		const fileData = await this.getOrInitializeFileData(path);
		this.plugin.settings.files[path] = {
			...fileData,
			hierarchy,
		};
	}
}
