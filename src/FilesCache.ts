import * as time from "date-fns";
import { Component, type TAbstractFile, type TFile } from "obsidian";
import type OOTPlugin from "./main";
import { type ErrorToBeSolved } from "./Settings";
import { formatDate, parseDate } from "./utils";

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

		// check if there are any files that have errors to be solved
		// notify the user that there are errors to be solved
		// and that he can check all the files with errors in the "Object Oriented Thinking Errors List"
	}

	getFileErrorToBeSolved(path: string) {
		const fileData = this.getInitializedFileData(path);
		return fileData.errorToBeSolved;
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

	setFileErrorToBeSolved(path: string, errorToBeSolved: ErrorToBeSolved) {
		const fileData = this.getInitializedFileData(path);

		this.plugin.settings.files[path] = {
			...fileData,
			errorToBeSolved,
		};
	}

	async removeFileErrorToBeSolved(file: TFile) {
		if (!(file.path in this.plugin.settings.files))
			throw new Error(`File data of ${file.path} not found`);

		delete this.plugin.settings.files[file.path]!.errorToBeSolved;
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
