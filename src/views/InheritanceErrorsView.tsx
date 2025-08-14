import { View, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import OOTPlugin from "src/main";
import { InheritanceErrors } from "../ui/InheritanceErrors";

export const INHERITANCE_ERROR_VIEW_TYPE = "inheritance-errors-view";

export class InheritanceErrorsView extends View {
	private root?: Root;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: OOTPlugin,
	) {
		super(leaf);
	}

	getViewType() {
		return INHERITANCE_ERROR_VIEW_TYPE;
	}

	getDisplayText() {
		return "Inheritance errors";
	}

	getIcon() {
		return "list";
	}

	protected async onOpen() {
		this.root = createRoot(this.containerEl);
		this.render();
	}

	render() {
		this.root?.render(
			<StrictMode>
				<InheritanceErrors plugin={this.plugin} />
			</StrictMode>,
		);
	}

	protected async onClose() {
		this.root?.unmount();
	}
}
