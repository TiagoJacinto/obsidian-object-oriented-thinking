import { Modal, Setting } from 'obsidian';
import type OOTPlugin from './main';
import { type View } from './Settings';

export function updateDisplay(view: View) {
	return !view.name;
}

export class ViewModal extends Modal {
	plugin: OOTPlugin;
	view: View;
	saveCallback: (view: View) => void;

	constructor(plugin: OOTPlugin, saveCallback: (view: View) => void, view: View) {
		super(plugin.app);
		this.view = view;
		this.plugin = plugin;
		this.saveCallback = saveCallback;
	}

	onOpen() {
		this.titleEl.setText('Edit View');
		const view = this.view;

		new Setting(this.contentEl).setName('Name').addText((text) => {
			text.setValue(view.name);
			text.onChange(async (newValue) => {
				view.name = newValue;
				saveButton.setDisabled(updateDisplay(view));
			});
		});

		new Setting(this.contentEl).setName('File Path Accessor').addText((text) => {
			text.setValue(view.filePathAccessor);
			text.onChange(async (newValue) => {
				view.filePathAccessor = newValue;
			});
		});

		const saveButton = new Setting(this.contentEl).setDesc('').addButton((b) => {
			b.setButtonText('Save');
			b.onClick(() => {
				this.saveCallback(view);
				this.close();
			});
		});

		saveButton.setDisabled(updateDisplay(view));
	}
}
