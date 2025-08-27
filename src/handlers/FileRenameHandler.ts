import { type TFile } from "obsidian";
import { Handler } from "src/Handler";

type Context = { file: TFile; oldPath: string };

export class FileRenameHandler extends Handler<{ oldPath: string }> {
	protected async executeImpl({ file, oldPath }: Context) {
		const oldFileData =
			await this.plugin.filesCacheService.getOrInitializeFileData(oldPath);

		this.plugin.settings.files[file.path] = oldFileData;
		delete this.plugin.settings.files[oldPath];

		await this.updateHierarchyPathSection(file, oldPath, file.path);

		const fileData =
			await this.plugin.filesCacheService.getOrInitializeFileData(file);

		const dependentFiles = this.plugin.toExistingFiles(fileData.extendedBy);
		dependentFiles.forEach((f) =>
			this.plugin.filesCacheService.setFileExtends(f.path, file),
		);

		const parentPath = fileData.extends;
		if (parentPath)
			await this.plugin.filesCacheService.updateFileExtendedBy(
				parentPath,
				oldPath,
				file.path,
			);

		await this.plugin.saveSettings();
	}

	async updateHierarchyPathSection(
		file: TFile,
		oldPath: string,
		newPath: string,
	) {
		const fileData =
			await this.plugin.filesCacheService.getOrInitializeFileData(file);

		await this.plugin.filesCacheService.updateHierarchyPath(
			file.path,
			oldPath,
			newPath,
		);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.plugin.app.vault.getFileByPath(filePath),
		);

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			await this.updateHierarchyPathSection(dependentFile, oldPath, newPath);
		}
	}
}
