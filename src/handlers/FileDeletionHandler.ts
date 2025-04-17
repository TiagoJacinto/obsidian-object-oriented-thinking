import { type TAbstractFile, type TFile } from 'obsidian';
import { Handler } from 'src/Handler';

export class FileDeletionHandler extends Handler {
	async impl(path: string) {
		const fileData = this.plugin.filesCacheService.getInitializedFileData(path);

		const dependentFiles = this.plugin.toExistingFiles(fileData.extendedBy);

		await this.updateObjectTagRightTrail(dependentFiles, fileData.id);

		dependentFiles.forEach((f) => this.plugin.filesCacheService.setFileExtends(f.path, null));

		const parentPath = fileData.extends;
		if (parentPath) this.plugin.filesCacheService.removeFileExtendedBy(parentPath, path);

		delete this.plugin.settings.files[path];

		await this.plugin.saveSettings();
	}

	protected async executeImpl({ file }: { file: TFile }) {
		await this.impl(file.path);
	}

	private async updateObjectTagRightTrail(dependentFiles: TAbstractFile[], splitSection: string) {
		for (const dependentFile of dependentFiles) {
			const fileData = this.plugin.filesCacheService.getInitializedFileData(dependentFile.path);

			const newTag = fileData.hierarchy.split(splitSection + '/')[1]!;

			this.plugin.filesCacheService.setFileHierarchy(dependentFile.path, newTag);

			await this.updateObjectTagRightTrail(
				this.plugin.toExistingFiles(fileData.extendedBy),
				splitSection,
			);
		}
	}
}
