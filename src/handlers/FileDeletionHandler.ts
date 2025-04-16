import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';

export class FileDeletionHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		const fileData = this.plugin.filesCacheService.getInitializedFileData(file.path);

		const dependentFiles = fileData.extendedBy
			.map((filePath) => this.plugin.app.vault.getFileByPath(filePath))
			.filter(Boolean);

		await this.updateObjectTagRightTrail(dependentFiles, fileData.id);

		dependentFiles.forEach((f) => this.plugin.filesCacheService.setFileExtends(f.path, null));

		const parentPath = fileData.extends;
		if (parentPath) this.plugin.filesCacheService.removeFileExtendedBy(parentPath, file.path);

		delete this.plugin.settings.files[file.path];

		await this.plugin.saveSettings();
	}

	private async updateObjectTagRightTrail(dependentFiles: TFile[], splitSection: string) {
		for (const dependentFile of dependentFiles) {
			const fileData = this.plugin.filesCacheService.getInitializedFileData(dependentFile.path);

			const newTag = fileData.hierarchy.split(splitSection + '/')[1]!;

			this.plugin.filesCacheService.setFileHierarchy(dependentFile.path, newTag);

			await this.updateObjectTagRightTrail(
				fileData.extendedBy
					.map((filePath) => this.plugin.app.vault.getFileByPath(filePath))
					.filter(Boolean),
				splitSection,
			);
		}
	}
}
