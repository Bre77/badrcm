module.exports = {
    extends: './base.js',
    env: {
        browser: true,
        node: false, // enabled in eslint-config-airbnb-base
    },
    globals: {
        // Replaced by webpack at build time:
        __dirname: true,
        __filename: true,
    },
};
