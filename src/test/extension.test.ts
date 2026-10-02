// Minimal placeholder test suite for aw-watcher-vscode.
//
// The extension's main logic (``ActivityWatch`` class) is tightly coupled to
// the VS Code extension host, so we don't exercise it here. Instead we verify
// that the TypeScript module compiles and the exported entry point exists.
//
// Real integration tests should run via ``@vscode/test-cli`` (see the
// ``npm test`` script and ``.vscode-test.js`` config).

import * as assert from 'assert';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('aw-watcher-vscode', () => {
    it('compiles and has a valid entry point', () => {
        // The build emits ``out/src/extension.js``; verify the file exists.
        const entry = resolve(__dirname, '..', 'extension.js');
        assert.ok(existsSync(entry), `expected compiled entry at ${entry}`);
    });
});
