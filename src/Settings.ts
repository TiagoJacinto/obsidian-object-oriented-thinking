import { type App, type SearchComponent, PluginSettingTab, Setting } from 'obsidian';

import type OOTPlugin from './main';

import { FolderSuggest } from './suggesters/FolderSuggester';
import { type Frontmatter } from './types';
import { filter } from 'ramda';
import { z } from 'zod/v4';
import { ViewModal, updateDisplay } from './ViewModal';
import deepEqual from 'fast-deep-equal';

const onlyUniqueArray = <T>(value: T, index: number, self: T[]) => {
	return self.findIndex((v) => deepEqual(v, value)) === index;
};

const ViewSchema = z.object({
	name: z.string(),
	filePathAccessor: z.string(),
});

export type View = z.infer<typeof ViewSchema>;

export const PluginSettingsSchema = z.object({
	ignoredFolders: z.array(z.string()),
	minMinutesBetweenSaves: z.number().min(0),
	minSoftExclusionDays: z.number().min(0),
	superPropertyName: z.string(),
	files: z.record(
		z.string(),
		z.object({
			extends: z.string().optional(),
			extendedBy: z.array(z.string()),
			hierarchy: z.array(z.string()),
			updatedAt: z.string().optional(),
			softExcludedAt: z.string().optional(),
		}),
	),
	views: z.array(ViewSchema),
});

export type PluginSettings = z.infer<typeof PluginSettingsSchema>;

export const DEFAULT_SETTINGS: PluginSettings = {
	ignoredFolders: [],
	files: {},
	views: [
		{
			name: 'dataview',
			filePathAccessor: '.file.path',
		},
	],
	minMinutesBetweenSaves: 0,
	minSoftExclusionDays: 14,
	superPropertyName: 'extends',
};

type SearchAndRemoveArgs = {
	name: string;

	currentList: string[];
	description: string;

	setValue: (newValue: string[]) => void;
};

export class OOTSettingsTab extends PluginSettingTab {
	plugin: OOTPlugin;

	private async saveSettings() {
		await this.plugin.saveSettings();
	}

	constructor(app: App, plugin: OOTPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;

		containerEl.empty();

		this.addViewsSetting();
		this.addExcludedFoldersSetting();
		this.addTimeForSoftExclusion();
		this.addTimeBetweenUpdates();

		this.addSuperObjectPropertyName();
	}

	addViewsSetting() {
		this.doViewsList();
	}

	addExcludedFoldersSetting() {
		this.doSearchAndRemoveList({
			name: 'Folder to exclude of all updates',

			currentList: this.plugin.settings.ignoredFolders,
			description:
				'Any file updated in this folder will not trigger an updated and created update.',

			setValue: (newValue) => {
				this.plugin.settings.ignoredFolders = newValue;
			},
		});
	}

	addTimeForSoftExclusion() {
		new Setting(this.containerEl)
			.setName('Minimum number of days for excluding files')
			.addSlider((slider) =>
				slider
					.setLimits(0, 120, 1)
					.setValue(this.plugin.settings.minSoftExclusionDays)
					.onChange(async (value) => {
						this.plugin.settings.minSoftExclusionDays = value;
						await this.saveSettings();
					})
					.setDynamicTooltip(),
			);
	}

	addTimeBetweenUpdates() {
		new Setting(this.containerEl)
			.setName('Minimum number of minutes between update')
			.setDesc('If your files are updating too often, increase this.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 30, 1)
					.setValue(this.plugin.settings.minMinutesBetweenSaves)
					.onChange(async (value) => {
						this.plugin.settings.minMinutesBetweenSaves = value;
						await this.saveSettings();
					})
					.setDynamicTooltip(),
			);
	}

	addSuperObjectPropertyName() {
		new Setting(this.containerEl)
			.setName('Super object property name')
			.setDesc('The name of the super object property.')
			.addText((text) =>
				text
					.setPlaceholder('extends')
					.setValue(this.plugin.settings.superPropertyName)
					.onChange(async (value) => {
						const previousSuperPropertyName = this.plugin.settings.superPropertyName;
						const newSuperPropertyName = value;

						if (previousSuperPropertyName === newSuperPropertyName) return;

						const extendingFiles = filter((f) => Boolean(f.extends), this.plugin.settings.files);

						for (const filePath of Object.keys(extendingFiles)) {
							const file = this.app.vault.getFileByPath(filePath);
							if (!file) continue;

							await this.app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
								const superPropertyValue = frontmatter[previousSuperPropertyName];
								delete frontmatter[previousSuperPropertyName];
								frontmatter[newSuperPropertyName] = superPropertyValue;
							});
						}

						this.plugin.settings.superPropertyName = value;
						await this.saveSettings();
					}),
			);
	}

	doSearchAndRemoveList({ name, currentList, description, setValue }: SearchAndRemoveArgs) {
		let searchInput: SearchComponent | undefined;
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addSearch((cb) => {
				searchInput = cb;
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder('Example: folder1/folder2');
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				cb.containerEl.addClass('time-search');
			})
			.addButton((cb) => {
				cb.setIcon('plus');
				cb.setTooltip('Add folder');
				cb.onClick(async () => {
					if (!searchInput) {
						return;
					}
					const newFolder = searchInput.getValue();

					for (const filePath of Object.keys(this.plugin.settings.files)) {
						if (filePath.startsWith(newFolder))
							this.plugin.filesCacheService.setFileSoftExcludedAt(filePath);
					}

					setValue([...currentList, newFolder].filter(onlyUniqueArray));
					await this.saveSettings();
					searchInput.setValue('');
					this.display();
				});
			});

		for (const ignoredFolder of currentList) {
			new Setting(this.containerEl).setName(ignoredFolder).addButton((button) =>
				button.setButtonText('Remove').onClick(async () => {
					setValue(currentList.filter((value) => value !== ignoredFolder));

					const filesToInclude = this.plugin.app.vault
						.getMarkdownFiles()
						.filter((f) => f.path.startsWith(ignoredFolder));

					for (const file of filesToInclude) {
						if (this.plugin.filesCacheService.fileDataExists(file.path)) {
							this.plugin.filesCacheService.includeFile(file.path);
							continue;
						}

						await this.plugin.fileCreationHandler.execute({ file });
					}

					await this.saveSettings();
					this.display();
				}),
			);
		}
	}

	doViewsList() {
		new Setting(this.containerEl)
			.setName('Views')
			.setDesc('Define a view so that you can have a custom function for accessing the file path')
			.addButton((bc) => {
				bc.setIcon('plus')
					.setTooltip('Add view')
					.onClick(async () => {
						this.plugin.settings.views = [
							...this.plugin.settings.views,
							{
								name: '',
								filePathAccessor: '.',
							},
						].filter(onlyUniqueArray);

						await this.saveSettings();
						this.display();
					});
			});

		for (const view of this.plugin.settings.views) {
			const i = this.plugin.settings.views.indexOf(view);

			new Setting(this.containerEl)
				.setName(view.name)
				.addButton((button) => {
					button.onClick(async () => {
						const oldView = this.plugin.settings.views[i + 1]!;
						this.plugin.settings.views[i + 1] = view;
						this.plugin.settings.views[i] = oldView;
						await this.saveSettings();
						this.display();
					});
					button.setIcon('down-arrow-with-tail');
					button.setTooltip('Move view down');
					if (i === this.plugin.settings.views.length - 1) {
						button.setDisabled(true);
					}
				})
				.addButton((button) => {
					button.onClick(async () => {
						const oldView = this.plugin.settings.views[i - 1]!;
						this.plugin.settings.views[i - 1] = view;
						this.plugin.settings.views[i] = oldView;
						await this.saveSettings();
						this.display();
					});
					button.setIcon('up-arrow-with-tail');
					button.setTooltip('Move view up');
					if (i === 0) {
						button.setDisabled(true);
					}
				})
				.addButton((button) => {
					button
						.onClick(() => {
							const formModal = new ViewModal(
								this.plugin,
								async (newView) => {
									this.plugin.settings.views[i] = newView;
									await this.plugin.saveSettings();
									updateDisplay(view);
									this.display();
								},
								view,
							);
							formModal.open();
						})
						.setIcon('pencil')
						.setTooltip('Edit view');
				})
				.addButton((button) => {
					button.onClick(async () => {
						this.plugin.settings.views.remove(view);
						await this.plugin.saveSettings();
						this.display();
					});
					button.setIcon('cross');
					button.setTooltip('Remove view');
				});
		}
	}
}
