import OOTPlugin from "src/main";

type Props = {
	plugin: OOTPlugin;
};

export const InheritanceErrors = ({ plugin }: Props) => {
	return (
		<div className="inheritance-errors-container">
			<h3>Inheritance Errors</h3>
			<ol className="inheritance-errors-list">
				{Object.entries(plugin.settings.files)
					.filter(([, data]) => data.errorToBeSolved)
					.map(([path, data]) => (
						<li className="inheritance-error-item" key={path}>
							<a
								title="Go to file"
								onClick={async () => {
									const file = plugin.app.vault.getFileByPath(path);
									if (!file) return;
									const leaf = plugin.app.workspace.getMostRecentLeaf();
									await leaf?.openFile(file, { active: true });
								}}
							>
								{path}
							</a>
							<span>{plugin.ERROR_NOTICE[data.errorToBeSolved!]}</span>
						</li>
					))}
			</ol>
		</div>
	);
};
