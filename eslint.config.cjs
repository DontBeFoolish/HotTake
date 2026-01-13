const airbnb = require('eslint-config-airbnb-base')
const importPlugin = require('eslint-plugin-import')
const prettier = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs'
    },
    plugins: {
      import: importPlugin,
      prettier
    },
    rules: {
      ...airbnb.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'off'
    }
  }
]
