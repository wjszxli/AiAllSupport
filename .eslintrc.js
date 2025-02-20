const OFF = 0;

module.exports = {
    extends: '@yutengjing/eslint-config-react',
    rules: {
        'import/default': OFF,
        '@typescript-eslint/ban-ts-comment': OFF,
        'unicorn/consistent-destructuring': OFF,
        '@typescript-eslint/no-use-before-define': OFF,
        'import/no-extraneous-dependencies': OFF,
        'import/no-unresolved': OFF,
        'no-use-before-define': OFF,
        'unicorn/prefer-query-selector': OFF,
        'unicorn/prefer-node-remove': OFF,
        'unicorn/consistent-function-scoping': OFF,
        'jsx-a11y/no-static-element-interactions': OFF,
        'jsx-a11y/click-events-have-key-events': OFF,
    },
};
