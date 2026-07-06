import { Platform } from 'react-native';

export interface TelemetryProps {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Minimal, PII-free telemetry seam. Today it emits a structured console event;
 * swap the sink here when an analytics backend lands. NEVER pass user content
 * (cycle data, entries, keys) — only platform/OS and event metadata.
 */
export function logTelemetry(event: string, props: TelemetryProps = {}): void {
    const payload = {
        event,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        ts: new Date().toISOString(),
        ...props,
    };
    console.log('[telemetry]', JSON.stringify(payload));
}
