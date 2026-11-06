import * as assert from 'assert';
import { DEFAULT_SERVER_URL, buildBaseUrl } from '../server';

describe('server base URL', () => {
    it('uses the default when unset', () => {
        assert.strictEqual(buildBaseUrl('', '', ''), DEFAULT_SERVER_URL);
        assert.strictEqual(buildBaseUrl(undefined, undefined, undefined), DEFAULT_SERVER_URL);
    });

    it('trims and strips trailing slashes', () => {
        assert.strictEqual(buildBaseUrl('  http://example.com:5601/// ', '', ''), 'http://example.com:5601');
    });

    it('embeds Basic Auth credentials', () => {
        assert.strictEqual(
            buildBaseUrl('http://example.com:5601', 'user', 'pass'),
            'http://user:pass@example.com:5601'
        );
    });

    it('encodes special characters exactly once', () => {
        assert.strictEqual(
            buildBaseUrl('http://example.com', 'user@x', 'p:ss/word'),
            'http://user%40x:p%3Ass%2Fword@example.com'
        );
    });

    it('ignores incomplete credentials', () => {
        assert.strictEqual(buildBaseUrl('http://example.com', 'user', ''), 'http://example.com');
        assert.strictEqual(buildBaseUrl('http://example.com', '', 'pass'), 'http://example.com');
    });

    it('falls back to the base string for invalid URLs', () => {
        assert.strictEqual(buildBaseUrl('not a url', 'user', 'pass'), 'not a url');
    });
});
