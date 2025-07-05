import { type TAbstractFile, type TFile } from 'obsidian';
import { Handler } from 'src/Handler';

export class FileDeletionHandler extends Handler {
	async impl(path: string) {
		const fileData = this.plugin.filesCacheService.getInitializedFileData(path);

		const dependentFiles = this.plugin.toExistingFiles(fileData.extendedBy);

		await this.sliceHierarchyAtRightOfPath(dependentFiles, path);

		dependentFiles.forEach((f) => this.plugin.filesCacheService.setFileExtends(f.path, null));

		const parentPath = fileData.extends;
		if (parentPath) this.plugin.filesCacheService.removeFileExtendedBy(parentPath, path);

		delete this.plugin.settings.files[path];

		await this.plugin.saveSettings();
	}

	protected async executeImpl({ file }: { file: TFile }) {
		await this.impl(file.path);
	}

	private async sliceHierarchyAtRightOfPath(dependentFiles: TAbstractFile[], path: string) {
		for (const dependentFile of dependentFiles) {
			const fileData = this.plugin.filesCacheService.getInitializedFileData(dependentFile.path);

			// remove all at the right of path
			const newHierarchy = fileData.hierarchy.slice(fileData.hierarchy.indexOf(path) + 1);

			this.plugin.filesCacheService.setFileHierarchy(dependentFile.path, newHierarchy);

			await this.sliceHierarchyAtRightOfPath(
				this.plugin.toExistingFiles(fileData.extendedBy),
				path,
			);
		}
	}
}
