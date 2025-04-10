import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';

export class FileDeletionHandler extends Handler {
	async impl(path: string) {
		const fileData = this.plugin.filesCacheService.getCachedFile(path);

		const dependentFiles = fileData.extendedBy
			.map((filePath) => this.plugin.app.vault.getFileByPath(filePath))
			.filter(Boolean);

		await this.updateObjectTagRightTrail(dependentFiles, fileData.id);

		dependentFiles.forEach((f) => this.plugin.filesCacheService.setFileExtends(f.path, null));

		const parentPath = fileData.extends;
		if (parentPath) this.plugin.filesCacheService.removeFileExtendedBy(parentPath, path);

		delete this.plugin.settings.files[path];
	}

	protected async executeImpl({ file }: { file: TFile }) {
		await this.impl(file.path);
	}

	private async updateObjectTagRightTrail(dependentFiles: TFile[], splitSection: string) {
		for (const dependentFile of dependentFiles) {
			const newTag = this.plugin.filesCacheService
				.getCachedFile(dependentFile.path)
				.hierarchy.split(splitSection + '/')[1]!;

			this.plugin.filesCacheService.setFileHierarchy(dependentFile.path, newTag);

			await this.updateObjectTagRightTrail(
				this.plugin.filesCacheService
					.getCachedFile(dependentFile.path)
					.extendedBy.map((filePath) => this.plugin.app.vault.getFileByPath(filePath))
					.filter(Boolean),
				splitSection,
			);
		}
	}
}
