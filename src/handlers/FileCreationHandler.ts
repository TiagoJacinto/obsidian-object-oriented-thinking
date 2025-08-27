import * as time from "date-fns";
import { type TFile } from "obsidian";
import { Handler } from "src/Handler";
import { parseDate } from "src/utils";

export class FileCreationHandler extends Handler {
	protected async executeImpl({ file }: { file: TFile }) {
		const fileData =
			await this.plugin.filesCacheService.getOrInitializeFileData(file);
		const updatedAt = fileData.updatedAt;

		if (
			updatedAt === undefined ||
			this.fileChanged(file.stat.mtime, updatedAt)
		) {
			this.plugin.app.workspace.onLayoutReady(async () => {
				await this.plugin.updateObjectFileHierarchy(file);
			});
		}
	}

	private fileChanged(mTime: number, updatedAt: string) {
		const currentMTime = parseDate(mTime);

		const fileMTime = parseDate(updatedAt);
		if (!fileMTime) throw new Error("Something wrong happen, skipping");

		return time.isAfter(currentMTime, fileMTime);
	}
}
