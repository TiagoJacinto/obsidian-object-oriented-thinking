import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';
import { toId } from 'src/utils';

type Context = { file: TFile; oldPath: string };

export class FileRenameHandler extends Handler<{ oldPath: string }> {
	protected async executeImpl({ file, oldPath }: Context) {
		const oldFileData = this.plugin.filesCacheService.getInitializedFileData(oldPath);

		this.plugin.settings.files[file.path] = oldFileData;
		delete this.plugin.settings.files[oldPath];

		const oldId = oldFileData.id;
		const newId = toId(file.path);
		this.plugin.filesCacheService.setFileId(file, newId);

		this.updateHierarchyPathSection(file, oldId, newId);

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

		const newTag = fileData.hierarchy.replace(oldPath, newPath);
		this.plugin.filesCacheService.setFileHierarchy(file.path, newTag);

		const dependentFiles = fileData.extendedBy.map((filePath) =>
			this.plugin.app.vault.getFileByPath(filePath),
		);
		if (!dependentFiles) return;

		for (const dependentFile of dependentFiles) {
			if (!dependentFile) continue;

			this.updateHierarchyPathSection(dependentFile, oldPath, newPath);
		}
	}
}
