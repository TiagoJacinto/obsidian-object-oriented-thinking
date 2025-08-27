# Object Oriented Thinking

Add inheritance-like behavior to notes.

## Usage

### 1. Extend

In a note's frontmatter, add the property (default: `extends`) with a link to the parent note:

```md
---
extends: [[ParentNote]]
---
```

### 2. Query

Using utility methods: `getObjectFileByPath(path).isDescendantOf(parentObjectFile)`

## Methods

#### oot.getObjectFileByLink(link: `[[${string}]]`): TFile & {isDescendantOf: (parentFile: TFile) => boolean} | null

##### Examples

```js
const taskObjectFile = oot.getObjectFileByLink("[[Task]]")

dv.table(["File"], dv.pages().where(page => {
  const pageObjectFile = oot.getObjectFileByPath(page.file.path)

  return pageObjectFile?.isDescendantOf(taskObjectFile)
}).map(p => [p.file.link]))
```

#### oot.getObjectFileByPath(path: string): TFile & {isDescendantOf: (parentFile: TFile) => boolean} | null

##### Examples

```js
const currentObjectFile = oot.getObjectFileByPath(dv.current().file.path);

dv.table(
	['File'],
	dv
		.pages()
		.where((page) => {
			const pageObjectFile = oot.getObjectFileByPath(page.file.path);

			return pageObjectFile?.isDescendantOf(currentObjectFile);
		})
		.map((p) => [p.file.link]),
);
```

## Defining your own functions

You can define your own functions like this or use javascript loader plugins like [CustomJS](https://github.com/saml-dev/obsidian-custom-js):

```js
const isDescendantOf = (parentObjectFile) => (page) => oot.getObjectFileByPath(page.file.path)?.isDescendantOf(parentObjectFile) ?? false

const taskObjectFile = oot.getObjectFileByLink("[[Inbox/Task|Task]]")

dv.table(["File"], dv.pages().where(isDescendantOf(taskObjectFile)).map(p => [p.file.link]))
```

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
