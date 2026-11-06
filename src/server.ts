// Server URL resolution, kept free of `vscode` imports so it can be unit tested.

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:5600';

/**
 * Resolve the AW server base URL from the `serverUrl` setting.
 *
 * Custom host/port setups are covered by `serverUrl` directly. When Basic
 * Auth credentials are configured (nginx `auth_basic`), they are embedded
 * in the URL since the fetch-based aw-client-js has no axios instance for
 * header injection. Invalid URLs fall back to the unmodified base string
 * (the fetch will then fail with a clear error).
 */
export function buildBaseUrl(serverUrl: unknown, authUser: unknown, authPassword: unknown): string {
    const base =
        typeof serverUrl === 'string' && serverUrl.trim() ? serverUrl.trim().replace(/\/+$/, '') : DEFAULT_SERVER_URL;
    if (typeof authUser === 'string' && authUser && typeof authPassword === 'string' && authPassword) {
        try {
            const parsed = new URL(base);
            // URL setters percent-encode automatically: assign raw values,
            // pre-encoding here would double-encode special characters.
            parsed.username = authUser;
            parsed.password = authPassword;
            return parsed.toString().replace(/\/+$/, '');
        } catch {
            return base;
        }
    }
    return base;
}
