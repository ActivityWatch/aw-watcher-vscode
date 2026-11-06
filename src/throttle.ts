// Heartbeat throttling, kept free of `vscode` imports so it can be unit tested.

export const DEFAULT_MAX_HEARTBEATS_PER_SEC = 1;

/**
 * Validate a configured `maxHeartbeatsPerSec` value. Fractional values are
 * allowed (0.5 = one heartbeat every 2 seconds); anything that is not a
 * positive finite number falls back to the default.
 */
export function parseMaxHeartbeatsPerSec(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }
    return DEFAULT_MAX_HEARTBEATS_PER_SEC;
}

/** Minimum time between two heartbeats for the same file and branch, in ms. */
export function heartbeatIntervalMs(maxHeartbeatsPerSec: number): number {
    return 1000 / maxHeartbeatsPerSec;
}

export interface HeartbeatState {
    file: string;
    branch: string;
    time: number; // ms since epoch, 0 = never sent
}

/**
 * Decide whether a heartbeat should be sent: always when the file or branch
 * changed, otherwise only once the throttle interval has elapsed.
 */
export function shouldSendHeartbeat(
    last: HeartbeatState,
    current: HeartbeatState,
    maxHeartbeatsPerSec: number
): boolean {
    return (
        current.file !== last.file ||
        current.branch !== last.branch ||
        current.time - last.time >= heartbeatIntervalMs(maxHeartbeatsPerSec)
    );
}
