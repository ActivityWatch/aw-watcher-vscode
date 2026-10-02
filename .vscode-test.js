// .vscode-test.js — config for @vscode/test-cli
// See https://github.com/microsoft/vscode-test-cli
module.exports = {
    files: 'out/src/test/**/*.test.js',
    version: 'stable',
    workspaceFolder: './',
    mocha: {
        ui: 'tdd',
        useColors: true,
    },
};
