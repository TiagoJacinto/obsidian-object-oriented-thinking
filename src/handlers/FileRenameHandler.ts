import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';

type Context = { file: TFile; oldPath: string };

export class FileRenameHandler extends Handler<{ oldPath: string }> {
	protected async executeImpl({ file, oldPath }: Context) {
		const oldFileData = this.plugin.filesCacheService.getInitializedFileData(oldPath);

		this.plugin.settings.files[file.path] = oldFileData;
		delete this.plugin.settings.files[oldPath];

		this.updateHierarchyPathSection(file, oldPath, file.path);

		const fileData = this.plugin.filesCacheService.getInitializedFileData(file.path);

		const dependentFiles = this.plugin.toExistingFiles(fileData.extendedBy);
		dependentFiles.forEach((f) => this.plugin.filesCacheService.setFileExtends(f.path, file));

		const parentPath = fileData.extends;
		if (parentPath)
			this.plugin.filesCacheService.updateFileExtendedBy(parentPath, oldPath, file.path);

		await this.plugin.saveSettings();
	}

	updateHierarchyPathSection(file: TFile, oldPath: string, newPath: string) {
		const fileData = this.plugin.filesCacheService.getInitializedFileData(file.path);

		this.plugin.filesCacheService.updateHierarchyPath(file.path, oldPath, newPath);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.plugin.app.vault.getFileByPath(filePath),
		);

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			this.updateHierarchyPathSection(dependentFile, oldPath, newPath);
		}
	}
}
