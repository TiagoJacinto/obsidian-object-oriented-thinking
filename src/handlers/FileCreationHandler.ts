import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';
import * as time from 'date-fns';
import { parseDate } from 'src/utils';

export class FileCreationHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		if (!this.plugin.filesCacheService.fileDataExists(file.path)) {
			await this.plugin.filesCacheService.initializeFileData(file);
			await this.plugin.saveSettings();
			return;
		}

		const fileData = this.plugin.filesCacheService.getInitializedFileData(file.path);
		const updatedAt = fileData.updatedAt;

		if (updatedAt === undefined || this.fileChanged(file.stat.mtime, updatedAt)) {
			await this.plugin.updateObjectFileHierarchy(file);
			this.plugin.filesCacheService.setFileUpdatedAt(file);
			await this.plugin.saveSettings();
		}
	}

	private fileChanged(mTime: number, updatedAt: string) {
		const currentMTime = parseDate(mTime);

		const fileMTime = parseDate(updatedAt);
		if (!fileMTime) throw new Error('Something wrong happen, skipping');

		return time.isAfter(currentMTime, fileMTime);
	}
}
