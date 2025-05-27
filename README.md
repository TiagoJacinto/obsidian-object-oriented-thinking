# Obsidian Object Oriented Thinking

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

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)

- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`
