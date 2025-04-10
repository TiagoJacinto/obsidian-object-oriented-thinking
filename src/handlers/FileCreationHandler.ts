import { type TFile } from 'obsidian';
import { Handler } from 'src/Handler';
import * as time from 'date-fns';

export class FileCreationHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		const updatedAt = this.plugin.filesCacheService.getCachedFile(file.path).updatedAt;

		if (!updatedAt || this.fileChanged(file.stat.mtime, updatedAt)) {
			await this.plugin.updateObjectFileHierarchy(file);
			this.plugin.filesCacheService.setFileUpdatedAt(file);
		}
	}

	private fileChanged(mTime: number, updatedAt: string) {
		const currentMTime = this.plugin.parseDate(mTime);

		const fileMTime = this.plugin.parseDate(updatedAt);
		if (!fileMTime) throw new Error('Something wrong happen, skipping');

		return time.isAfter(currentMTime, fileMTime);
	}
}
