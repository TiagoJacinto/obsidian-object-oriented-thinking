import { TFile, type TAbstractFile } from 'obsidian';
import type OOTPlugin from './main';

const isTFile = (value: TAbstractFile): value is TFile => value instanceof TFile;

export abstract class Handler<TContext = unknown> {
	constructor(protected readonly plugin: OOTPlugin) {}

	protected abstract executeImpl(ctx: TContext & { file: TFile }): Promise<void>;

	async execute(ctx: TContext & { file: TAbstractFile }) {
		if (!isTFile(ctx.file) || this.plugin.shouldFileBeIgnored(ctx.file))
			return { status: 'ignored' };

		try {
			await this.executeImpl(ctx as TContext & { file: TFile });
			await this.plugin.saveSettings();
		} catch (error) {
			console.error(error);

			return {
				error,
				status: 'error',
			};
		}

		return { status: 'ok' };
	}
}
