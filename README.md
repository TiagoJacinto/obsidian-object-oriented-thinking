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

Using utility methods `(childObjectFileByPath(path).isObjectOf(parentObjectFile))`

## Utilities

### Methods

#### oot.utilities.isObjectFile(file: TFile): boolean

##### Examples

```js
const file = app.vault.getFileByPath('Inbox/File');
oot.utilities.isObjectFile(file);
```

#### oot.utilities.parentObjectFileByLiteralLink(literalLink: `[[${string}]]`): TFile | null

##### Examples

```js
oot.utilities.parentObjectFileByLiteralLink('[[File]]');
```

#### oot.utilities.parentObjectFileByPath(path: string): TFile | null

##### Examples

```js
oot.utilities.parentObjectFileByPath('Inbox/File');
```

#### oot.utilities.childObjectFileByPath(path: string): { isObjectOf: (parentFile: TFile) => boolean; isDescendentOf: (parentFile: TFile) => boolean; } | null

##### Examples

```dataviewjs
const {parentObjectFileByLiteralLink, childObjectFileByPath} = oot.utilities
const taskObjectFile = parentObjectFileByLiteralLink("[[Inbox/Task|Task]]")

dv.table(["File"], dv.pages().where(page => childObjectFileByPath(page.file.path).isObjectOf(taskObjectFile)
).map(p => [p.file.link]))
```

You can define your own functions like this or use javascript loader plugins like [CustomJS](https://github.com/saml-dev/obsidian-custom-js):

```dataviewjs
const {parentObjectFileByLiteralLink, childObjectFileByPath} = oot.utilities
const isObjectOf = (objectFile) => (page) => childObjectFileByPath(page.file.path).isObjectOf(objectFile)

const taskObjectFile = parentObjectFileByLiteralLink("[[Inbox/Task|Task]]")

dv.table(["File"], dv.pages().where(isObjectOf(taskObjectFile)).map(p => [p.file.link]))
```

#### oot.utilities.objectHierarchyByPath(path: string): string[] | null

##### Examples

```dataviewjs
const taskObjectFile = oot.utilities.objectFileByLiteralLink("[[Inbox/Task|Task]]")

dv.table(["File"], dv.pages().where(page => oot.utilities.objectHierarchyByPath(page.file.path)?.includes(taskObjectFile.path) ?? false).map(p => [p.file.link]))
```

#### oot.utilities.objectHierarchyByFile(file: TFile): string[] | null

##### Examples

```dataviewjs
const file = app.vault.getFileByPath('Inbox/File');
oot.utilities.objectHierarchyByFile(file)
```

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
