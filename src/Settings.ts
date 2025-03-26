import { type App, type SearchComponent, PluginSettingTab, Setting } from 'obsidian';
import * as time from 'date-fns';

import type OOTPlugin from './main';

import { FolderSuggest } from './suggesters/FolderSuggester';
import { type Frontmatter } from './types';

const onlyUniqueArray = <T>(value: T, index: number, self: T[]) => self.indexOf(value) === index;

export type OOTPluginSettings = {
	dateFormat: string;
	files: Record<
		string,
		{
			id: string;

			extendedBy: string[];
			objectTag: string;
			updatedAt?: string;
		}
	>;
	headerNames: {
		id: string;
	};
	hideIdProperty: boolean;
	hideObjectTag: boolean;
	hideObjectTagPrefix: boolean;
	ignoredFolders?: string[];
	minMinutesBetweenSaves: number;
	objectTagPrefix: string;
	superPropertyName: string;
};

export const DEFAULT_SETTINGS: OOTPluginSettings = {
	dateFormat: "yyyy-MM-dd'T'HH:mm",
	files: {},
	headerNames: {
		id: 'id',
	},
	hideIdProperty: false,
	hideObjectTag: false,
	hideObjectTagPrefix: false,
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
		this.addTimeBetweenUpdates();
		this.addDateFormat();

		this.addSuperObjectPropertyName();

		this.addObjectTagPrefix();
		this.addToggleForHidingObjectTag();
		this.addToggleForHidingObjectTagPrefix();

		this.addFrontMatterId();
		this.addToggleForHidingIdProperty();
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

	addFrontMatterId() {
		new Setting(this.containerEl)
			.setName('Front matter id name')
			.setDesc('The key in the front matter yaml for the id.')
			.addText((text) =>
				text
					.setPlaceholder('id')
					.setValue(this.plugin.settings.headerNames.id)
					.onChange(async (value) => {
						this.plugin.settings.headerNames.id = value;
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

					for (const filePath of Object.keys(this.plugin.settings.files)) {
						const file = this.app.vault.getFileByPath(filePath);
						if (!file) continue;

						await this.app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
							if (!frontmatter.tags) return;

							frontmatter.tags = frontmatter.tags.map((tag) =>
								tag.startsWith(previousPrefix) ? newPrefix + tag.split(previousPrefix)[1] : tag,
							);
						});
					}

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

	addToggleForHidingObjectTag() {
		new Setting(this.containerEl).setName('Hide object tag').addToggle(async (toggle) => {
			toggle.setValue(this.plugin.settings.hideObjectTag);
			await this.saveSettings();
		});
	}

	addToggleForHidingObjectTagPrefix() {
		new Setting(this.containerEl).setName('Hide object tag prefix').addToggle(async (toggle) => {
			toggle.setValue(this.plugin.settings.hideObjectTagPrefix);
			await this.saveSettings();
		});
	}

	addToggleForHidingIdProperty() {
		new Setting(this.containerEl).setName('Hide id property').addToggle(async (toggle) => {
			toggle.setValue(this.plugin.settings.hideIdProperty);
			await this.saveSettings();
		});
	}

	addExcludedFoldersSetting() {
		this.doSearchAndRemoveList({
			name: 'Folder to exclude of all updates',

			currentList: this.plugin.getIgnoredFolders(),
			description:
				'Any file updated in this folder will not trigger an updated and created update.',

			setValue: async (newValue) => {
				this.plugin.settings.ignoredFolders = newValue;
			},
		});
	}

	doSearchAndRemoveList({
		name,

		currentList,
		description,
		setValue,
	}: SearchAndRemoveArgs) {
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
