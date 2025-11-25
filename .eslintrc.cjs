// .eslintrc.cjs
module.exports = {
  root: true,
  extends: ['@react-native-community', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint", "prettier'],
  env: {
    'jest/globals': true,
  },
  rules: {
    'prettier/prettier': ['error'],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off',
      },
    },
  ],
};
