import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        files: ['**/*.{js}'],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true, // Enable JSX parsing
                },
            },
        },
        settings: {
            react: {
                version: 'detect', // Automatically detect your React version
            },
        },
        rules: {
            // Base React rules
            ...reactPlugin.configs.flat.recommended.rules,
            ...reactPlugin.configs.flat['jsx-runtime'].rules, // Use this for React 17+ (omits required React import)

            // Hooks rules
            ...reactHooks.configs.flat.recommended.rules,
        },
    },
];
