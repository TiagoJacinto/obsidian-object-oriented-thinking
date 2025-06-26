# Object Oriented Thinking

Add inheritance-like behavior to notes.

## Features

- On-Demand Tag Generation

## Usage

### 1. Extend

In a note's frontmatter, add the property (default: `extends`) with a link to the parent note:

```md
---
extends: [[ParentNote]]
---
```

### 2. Get Object Tag

To retrieve the object tag for a note, call the following JavaScript function:

```js
tagOfObjectLink('[[ChildNote]]'); // returns object tag prefix (default: Object) + note hierarchy (e.g., ParentNote/ChildNote)
```

This will add object tags to the frontmatter of the entire hierarchy:

Parent Note:

```md
---
tags:
  - Object/ParentNote
---
```

Child Note:

```md
---
tags:
  - Object/ParentNote/ChildNote
---
```

### 3. Changing the Hierarchy

Update the `extends` property to change a note’s parent. When you next call `tagOfObjectLink`, the tag will reflect the updated hierarchy.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
