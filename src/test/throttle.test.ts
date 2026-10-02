import * as assert from 'assert';
import {
    DEFAULT_MAX_HEARTBEATS_PER_SEC,
    HeartbeatState,
    heartbeatIntervalMs,
    parseMaxHeartbeatsPerSec,
    shouldSendHeartbeat,
} from '../throttle';

describe('heartbeat throttle', () => {
    const last: HeartbeatState = { file: '/a.ts', branch: 'master', time: 10_000 };

    it('accepts fractional rates', () => {
        assert.strictEqual(parseMaxHeartbeatsPerSec(0.5), 0.5);
        assert.strictEqual(heartbeatIntervalMs(0.5), 2000);
        assert.strictEqual(heartbeatIntervalMs(2), 500);
    });

    it('falls back to the default for invalid rates', () => {
        for (const value of [0, -1, NaN, Infinity, '0.5', undefined, null]) {
            assert.strictEqual(parseMaxHeartbeatsPerSec(value), DEFAULT_MAX_HEARTBEATS_PER_SEC);
        }
    });

    it('throttles repeated events on the same file and branch', () => {
        assert.strictEqual(shouldSendHeartbeat(last, { ...last, time: 11_000 }, 0.5), false);
        assert.strictEqual(shouldSendHeartbeat(last, { ...last, time: 11_999 }, 0.5), false);
        assert.strictEqual(shouldSendHeartbeat(last, { ...last, time: 12_000 }, 0.5), true);
    });

    it('sends immediately when the file or branch changes', () => {
        assert.strictEqual(shouldSendHeartbeat(last, { ...last, file: '/b.ts', time: 10_001 }, 0.5), true);
        assert.strictEqual(shouldSendHeartbeat(last, { ...last, branch: 'dev', time: 10_001 }, 0.5), true);
    });
});
