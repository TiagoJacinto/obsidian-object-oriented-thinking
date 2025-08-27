import { type TFile } from "obsidian";
import { Handler } from "src/Handler";

export class FileDeletionHandler extends Handler {
	async impl(path: string) {
		const fileData =
			await this.plugin.filesCacheService.getOrInitializeFileData(path);

		const dependentFiles = this.plugin.toExistingFiles(fileData.extendedBy);

		await this.sliceHierarchyAtRightOfPath(dependentFiles, path);

		dependentFiles.forEach((f) =>
			this.plugin.filesCacheService.setFileExtends(f.path, null),
		);

		const parentPath = fileData.extends;
		if (parentPath)
			await this.plugin.filesCacheService.removeFileExtendedBy(
				parentPath,
				path,
			);

		delete this.plugin.settings.files[path];

		await this.plugin.saveSettings();
	}

	protected async executeImpl({ file }: { file: TFile }) {
		await this.impl(file.path);
	}

	private async sliceHierarchyAtRightOfPath(
		dependentFiles: TFile[],
		path: string,
	) {
		for (const dependentFile of dependentFiles) {
			const fileData =
				await this.plugin.filesCacheService.getOrInitializeFileData(
					dependentFile.path,
				);

			// remove all at the right of path
			const newHierarchy = fileData.hierarchy.slice(
				fileData.hierarchy.indexOf(path) + 1,
			);

			await this.plugin.filesCacheService.setFileHierarchy(
				dependentFile.path,
				newHierarchy,
			);

			await this.sliceHierarchyAtRightOfPath(
				this.plugin.toExistingFiles(fileData.extendedBy),
				path,
			);
		}
	}
}
