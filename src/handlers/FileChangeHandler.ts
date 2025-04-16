import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';
import * as time from 'date-fns';

export class FileChangeHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		const fileData = this.plugin.filesCacheService.getInitializedFileData(file.path);

		const shouldUpdate =
			this.plugin.settings.saveMode === 'instant' ||
			(this.plugin.settings.saveMode === 'fixed' &&
				this.shouldUpdateFile(file.stat.mtime, fileData.updatedAt));

		if (shouldUpdate) {
			await this.plugin.updateObjectFileHierarchy(file);
			this.plugin.filesCacheService.setFileUpdatedAt(file);
			await this.plugin.saveSettings();
		}
	}

	private shouldUpdateFile(mTime: number, updatedAt: string | undefined) {
		if (updatedAt === undefined) return false;

		const currentMTime = this.plugin.parseDate(mTime);

		const fileMTime = this.plugin.parseDate(updatedAt);
		if (!fileMTime) return false;

		const nextUpdate = time.add(fileMTime, {
			minutes: this.plugin.settings.minMinutesBetweenSaves,
		});
		return time.isAfter(currentMTime, nextUpdate);
	}
}
