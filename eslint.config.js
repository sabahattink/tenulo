// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'drizzle/*', '.expo/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Without buttons, Android shows React Native's own "OK", in English whatever the app's language.
          selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert'][arguments.length<3]",
          message: 'Name the buttons, or use notify() from src/ui/notice.ts.',
        },
      ],
    },
  },
]);
