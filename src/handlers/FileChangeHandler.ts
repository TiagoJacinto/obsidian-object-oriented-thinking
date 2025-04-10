import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';
import * as time from 'date-fns';

export class FileChangeHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		const fileData = this.plugin.filesCacheService.getCachedFile(file.path);

		if (this.plugin.settings.saveMode === 'instant') {
			await this.plugin.updateObjectFileHierarchy(file);
			this.plugin.filesCacheService.setFileUpdatedAt(file);
		}

		if (this.plugin.settings.saveMode === 'fixed') {
			if (
				fileData.updatedAt === undefined ||
				this.shouldUpdateFile(file.stat.mtime, fileData.updatedAt)
			) {
				await this.plugin.updateObjectFileHierarchy(file);
				this.plugin.filesCacheService.setFileUpdatedAt(file);
			}
		}
	}

	private shouldUpdateFile(mTime: number, updatedAt: string) {
		const currentMTime = this.plugin.parseDate(mTime);

		const fileMTime = this.plugin.parseDate(updatedAt);
		if (!fileMTime) return false;

		const nextUpdate = time.add(fileMTime, {
			minutes: this.plugin.settings.minMinutesBetweenSaves,
		});
		return time.isAfter(currentMTime, nextUpdate);
	}
}
