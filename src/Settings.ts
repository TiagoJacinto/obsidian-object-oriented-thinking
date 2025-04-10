import { type App, type SearchComponent, PluginSettingTab, Setting } from 'obsidian';
import * as time from 'date-fns';

import type OOTPlugin from './main';

import { FolderSuggest } from './suggesters/FolderSuggester';
import { map } from 'ramda';

const onlyUniqueArray = <T>(value: T, index: number, self: T[]) => self.indexOf(value) === index;

export type CachedFile = {
	id: string;
	extends?: string;
	extendedBy: string[];
	objectTag: string;
	updatedAt?: string;
};

export type FilesCache = Record<string, CachedFile>;

type StoredCachedFile = Partial<CachedFile>;

export type PluginSettings = {
	dateFormat: string;
	hideObjectTag: boolean;
	hideObjectTagPrefix: boolean;
	ignoredFolders: string[];
	minMinutesBetweenSaves: number;
	objectTagPrefix: string;
	superPropertyName: string;
	saveMode: 'instant' | 'fixed';
	files: Record<string, StoredCachedFile>;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	dateFormat: "yyyy-MM-dd'T'HH:mm",
	ignoredFolders: [],
	files: {},
	hideObjectTag: false,
	hideObjectTagPrefix: false,
	saveMode: 'instant',
	minMinutesBetweenSaves: 1,
	objectTagPrefix: 'Object/',
	superPropertyName: 'extends',
};

type DateFormatArgs = {
	name: string;
	description: string;
	getValue: () => string;
	setValue: (newValue: string) => void;
};

type SearchAndRemoveArgs = {
	name: string;

	currentList: string[];
	description: string;

	setValue: (newValue: string[]) => Promise<void>;
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

		this.addExcludedFoldersSetting();
		this.addSaveModeToggle();
		if (this.plugin.settings.saveMode === 'fixed') {
			this.addTimeBetweenUpdates();
			this.addDateFormat();
		}

		this.addSuperObjectPropertyName();

		this.addObjectTagPrefix();
		this.addHideObjectTagToggle();
		this.addHideObjectTagPrefixToggle();
	}

	addExcludedFoldersSetting() {
		this.doSearchAndRemoveList({
			name: 'Folder to exclude of all updates',

			currentList: this.plugin.settings.ignoredFolders,
			description:
				'Any file updated in this folder will not trigger an updated and created update.',

			setValue: async (newValue) => {
				this.plugin.settings.ignoredFolders = newValue;
			},
		});
	}

	addSaveModeToggle() {
		new Setting(this.containerEl)
			.setName('Fixed time between updates')
			.addToggle(async (toggle) => {
				toggle.setValue(this.plugin.settings.saveMode === 'fixed').onChange(async (value) => {
					this.plugin.settings.saveMode = value ? 'fixed' : 'instant';
					await this.saveSettings();
					this.display();
				});
			});
	}

	addTimeBetweenUpdates() {
		new Setting(this.containerEl)
			.setName('Minimum number of minutes between update')
			.setDesc('If your files are updating too often, increase this.')
			.addSlider((slider) =>
				slider
					.setLimits(1, 30, 1)
					.setValue(this.plugin.settings.minMinutesBetweenSaves)
					.onChange(async (value) => {
						this.plugin.settings.minMinutesBetweenSaves = value;
						await this.saveSettings();
					})
					.setDynamicTooltip(),
			);
	}

	addDateFormat() {
		this.createDateFormatEditor({
			name: 'Date format',

			description: 'The date format for read and write',

			getValue: () => this.plugin.settings.dateFormat,
			setValue: (newValue) => (this.plugin.settings.dateFormat = newValue),
		});
	}

	createDateFormatEditor({
		name,

		description,
		getValue,
		setValue,
	}: DateFormatArgs) {
		const createDoc = () => {
			const descr = document.createDocumentFragment();
			descr.append(
				description,
				descr.createEl('br'),
				'Check ',
				descr.createEl('a', {
					href: 'https://date-fns.org/v2.25.0/docs/format',
					text: 'date-fns documentation',
				}),
				descr.createEl('br'),
				`Currently: ${time.format(new Date(), getValue())}`,
				descr.createEl('br'),
				`Obsidian default format for date properties: yyyy-MM-dd'T'HH:mm`,
			);
			return descr;
		};
		const dformat = new Setting(this.containerEl)
			.setName(name)
			.setDesc(createDoc())
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
					.setValue(getValue())
					.onChange(async (value) => {
						setValue(value);
						dformat.setDesc(createDoc());
						await this.saveSettings();
					}),
			);
	}

	addObjectTagPrefix() {
		const setting = new Setting(this.containerEl)
			.setName('Object tag prefix')
			.setDesc('The prefix for the object tag.');

		setting.addText((text) =>
			text
				.setPlaceholder('Object/')
				.setValue(this.plugin.settings.objectTagPrefix)
				.onChange(async (value) => {
					const previousPrefix = this.plugin.settings.objectTagPrefix;
					const newPrefix = value;

					if (previousPrefix === newPrefix) return;

					const hasInvalidTagCharacters = /[\\|!\"#$%\(\)\[\]=\{\}'\?`^~\+\*:\.,;]/g.test(
						newPrefix,
					);
					if (hasInvalidTagCharacters) {
						setting.controlEl.addClass('setting-error');
						return;
					}

					this.plugin.settings.files = map(
						(f) => ({ ...f, objectTag: f.objectTag?.replace(previousPrefix, newPrefix) }),
						this.plugin.settings.files,
					);

					setting.controlEl.removeClass('setting-error');
					this.plugin.settings.objectTagPrefix = newPrefix;
					await this.saveSettings();
				}),
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
						this.plugin.settings.superPropertyName = value;
						await this.saveSettings();
					}),
			);
	}

	addHideObjectTagToggle() {
		new Setting(this.containerEl).setName('Hide object tag').addToggle(async (toggle) => {
			toggle.setValue(this.plugin.settings.hideObjectTag).onChange(async (value) => {
				this.plugin.settings.hideObjectTag = value;
				await this.saveSettings();
			});
		});
	}

	addHideObjectTagPrefixToggle() {
		new Setting(this.containerEl).setName('Hide object tag prefix').addToggle(async (toggle) => {
			toggle.setValue(this.plugin.settings.hideObjectTagPrefix).onChange(async (value) => {
				this.plugin.settings.hideObjectTagPrefix = value;
				await this.saveSettings();
			});
		});
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

					await setValue([...currentList, newFolder].filter(onlyUniqueArray));
					await this.saveSettings();
					searchInput.setValue('');
					this.display();
				});
			});

		for (const ignoredFolder of currentList) {
			new Setting(this.containerEl).setName(ignoredFolder).addButton((button) =>
				button.setButtonText('Remove').onClick(async () => {
					await setValue(currentList.filter((value) => value !== ignoredFolder));
					await this.saveSettings();
					this.display();
				}),
			);
		}
	}
}
