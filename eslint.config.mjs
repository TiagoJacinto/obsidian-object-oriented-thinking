import personal from '@tiagojacinto/eslint-config';
import { config } from 'typescript-eslint';

export default config(
	{
		ignores: ['node_modules/', 'main.js'],
	},
	personal.configs.recommended({
		extensions: {
			withProjectService: true,
		},
		plugins: {
			formatting: {
				perfectionist: false,
			},
			languages: {
				typescript: true,
			},
		},
	}),
	{
		files: ['**/*.ts'],
		extends: [personal.configs.node],
		languageOptions: {
			parserOptions: {
				sourceType: 'module',
			},
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-prototype-builtins': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'sonarjs/constructor-for-side-effects': 'off',
			'sonarjs/no-invalid-await': 'off',
			'sonarjs/no-nested-functions': [
				'warn',
				{
					threshold: 5,
				},
			],
		},
	},
);
