import type { Bundle, BundleEntry, Observation, Patient } from 'fhir/r4';
import { v4 as uuidv4 } from 'uuid';

/**
 * LOINC and SNOMED CT coding constants for menstrual health observations.
 */
const LOINC_CYCLE_LENGTH = { system: 'http://loinc.org', code: '42798-9', display: 'Cycle Length' } as const;
const LOINC_MENSTRUAL_FLOW = { system: 'http://loinc.org', code: '92656-8', display: 'Menstrual Flow' } as const;
// 3144-3 = "Last menstrual period duration". The previous value (8339-4,
// "Birth weight measured", displayed as "Birth date") was wrong on both code
// and display — pinned by the code-constants test so it cannot regress.
const LOINC_PERIOD_LENGTH = { system: 'http://loinc.org', code: '3144-3', display: 'Last menstrual period duration' } as const;
// 8310-5 is the general body-temperature code; LOINC has no BBT-specific
// code, and 8310-5 is the standard choice for basal body temperature.
const LOINC_BODY_TEMP = { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' } as const;
const SNOMED_DYSMENORRHEA = { system: 'http://snomed.info/sct', code: '268953000', display: 'Dysmenorrhea' } as const;

/**
 * Known symptom → SNOMED CT mapping.
 * Symptoms not in this map are emitted as text-only Observations.
 */
const SYMPTOM_SNOMED_MAP: Record<string, { system: string; code: string; display: string }> = {
    cramps: SNOMED_DYSMENORRHEA,
};

/**
 * Base payload shape received after PRE decryption.
 * This is the raw JSON that both Provider and Partner portals receive.
 *
 * CONTRACT — ledger keys MUST be ISO `YYYY-MM-DD` (1-indexed month,
 * zero-padded). The mobile-internal day-map format is unpadded with a
 * 0-INDEXED month ("2026-2-3" = March 3), so a non-ISO key here is
 * ambiguous and the formatter throws rather than guess: a mis-guessed
 * month becomes a clinically wrong date in a provider-facing record.
 * Producers (the future share-payload builder) must convert day-map keys
 * to ISO on the mobile side, where the convention is known.
 */
export interface LocketPayload {
    config?: {
        lastPeriodDate?: string;
        bleedLength?: number;
        cycleLength?: number;
        periodLength?: number;
    };
    ledger?: Record<string, {
        flow?: string;
        symptoms?: string[];
        /**
         * Basal body temperature as logged. The mobile producer
         * (LogEntry.temperature) stores `{ value, unit }` as entered —
         * never normalized at write — with `null` as an explicit clear.
         * A bare number is also accepted, its unit inferred by magnitude
         * (the plausible-BBT °F and °C ranges do not overlap; same rule
         * as mobile's inferTemperatureUnit). Always emitted as °C.
         */
        temperature?: number | { value: number; unit: 'F' | 'C' } | null;
    }>;
}

/** FHIR R4 `date` requires zero-padded 1-indexed months: YYYY-MM-DD. */
const ISO_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** True only for keys that are both ISO-shaped and real calendar dates. */
function isValidIsoDateKey(key: string): boolean {
    if (!ISO_DATE_KEY.test(key)) return false;
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * FhirService — Edge-formatting engine for the Provider Portal.
 *
 * Converts raw Locket JSON (BaselineCycleData + LocketLedger) into an HL7 FHIR R4
 * Bundle containing anonymous Patient and coded Observation resources.
 *
 * This runs client-side in the Provider Portal browser AFTER PRE decryption.
 * The mobile app and serverless gateway never touch FHIR formatting.
 */
export class FhirService {
    /**
     * Generate a FHIR R4 collection Bundle from decrypted Locket data.
     *
     * @param userDid - Decentralized Identifier URI for the data owner
     * @param payload - Raw decrypted payload containing config and/or ledger
     * @returns FHIR R4 Bundle with Patient + Observation resources
     */
    static generateClinicalBundle(userDid: string, payload: LocketPayload): Bundle {
        const patientUuid = uuidv4();
        const patientReference = `urn:uuid:${patientUuid}`;
        const entries: BundleEntry[] = [];

        // Anonymous Patient resource — linked only by DID, no PII
        const patient: Patient = {
            resourceType: 'Patient',
            id: patientUuid,
            identifier: [{ system: 'urn:ietf:rfc:3986', value: userDid }],
            active: true,
        };
        entries.push({ fullUrl: patientReference, resource: patient });

        // Config-derived Observations
        if (payload.config) {
            const configDate = new Date().toISOString();

            if (payload.config.cycleLength !== undefined) {
                entries.push(
                    this.createQuantityObs(patientReference, configDate, LOINC_CYCLE_LENGTH, payload.config.cycleLength, 'days'),
                );
            }

            // Support both `bleedLength` (Payload Architecture) and `periodLength` (Onboarding)
            const periodLen = payload.config.bleedLength ?? payload.config.periodLength;
            if (periodLen !== undefined) {
                entries.push(
                    this.createQuantityObs(patientReference, configDate, LOINC_PERIOD_LENGTH, periodLen, 'days'),
                );
            }
        }

        // Ledger-derived Observations (daily entries)
        if (payload.ledger) {
            for (const [dateStr, log] of Object.entries(payload.ledger)) {
                if (!isValidIsoDateKey(dateStr)) {
                    throw new Error(
                        `Ledger key "${dateStr}" is not a valid ISO YYYY-MM-DD date. ` +
                        'Mobile-internal day-map keys are unpadded with a 0-indexed month ' +
                        '("2026-2-3" = March 3), so normalizing here would risk emitting a ' +
                        'clinically wrong date — the producer must convert to ISO before ' +
                        'building the payload (see the date-key schism note in TODOS.md).',
                    );
                }
                const isoDate = `${dateStr}T00:00:00Z`;

                // Menstrual flow → LOINC 92656-8
                if (log.flow) {
                    entries.push(
                        this.createStringObs(patientReference, isoDate, LOINC_MENSTRUAL_FLOW, log.flow),
                    );
                }

                // Basal body temperature → LOINC 8310-5, normalized to °C
                const tempC = this.normalizeTemperatureCelsius(log.temperature);
                if (tempC !== undefined) {
                    entries.push(
                        this.createQuantityObs(patientReference, isoDate, LOINC_BODY_TEMP, tempC, 'Cel'),
                    );
                }

                // Symptoms → SNOMED (known) or text-only CodeableConcept
                // (unknown). Unmapped symptoms must NOT fabricate a coding —
                // a coding without a `system` is non-conformant and validating
                // EHR importers reject it; FHIR's escape hatch is `code.text`.
                if (log.symptoms) {
                    for (const symptom of log.symptoms) {
                        const snomedCode = SYMPTOM_SNOMED_MAP[symptom.toLowerCase()];
                        if (snomedCode) {
                            entries.push(
                                this.createBooleanObs(patientReference, isoDate, snomedCode, true),
                            );
                        } else {
                            entries.push(
                                this.createTextCodedStringObs(patientReference, isoDate, symptom, symptom),
                            );
                        }
                    }
                }
            }
        }

        return {
            resourceType: 'Bundle',
            id: uuidv4(),
            type: 'collection',
            timestamp: new Date().toISOString(),
            entry: entries,
        };
    }

    // ── Private helpers ──────────────────────────────────────────────

    /**
     * Normalize a logged temperature to °C, or undefined if nothing usable
     * was logged (`null` is the mobile producer's explicit-clear state and
     * must not become a valueQuantity).
     */
    private static normalizeTemperatureCelsius(
        t: number | { value: number; unit: 'F' | 'C' } | null | undefined,
    ): number | undefined {
        if (t === null || t === undefined) return undefined;
        let value: number;
        let unit: 'F' | 'C';
        if (typeof t === 'number') {
            value = t;
            unit = t >= 50 ? 'F' : 'C'; // magnitude inference; ranges don't overlap
        } else {
            value = t.value;
            unit = t.unit;
        }
        if (!Number.isFinite(value)) return undefined;
        const celsius = unit === 'F' ? ((value - 32) * 5) / 9 : value;
        return Math.round(celsius * 100) / 100;
    }

    private static createQuantityObs(
        patientRef: string,
        date: string,
        coding: { system?: string; code: string; display: string },
        value: number,
        unit: string,
    ): BundleEntry {
        const id = uuidv4();
        const obs: Observation = {
            resourceType: 'Observation',
            id,
            status: 'final',
            code: { coding: [coding] },
            subject: { reference: patientRef },
            effectiveDateTime: date,
            valueQuantity: { value, unit },
        };
        return { fullUrl: `urn:uuid:${id}`, resource: obs };
    }

    private static createStringObs(
        patientRef: string,
        date: string,
        coding: { system?: string; code: string; display: string },
        value: string,
    ): BundleEntry {
        const id = uuidv4();
        const obs: Observation = {
            resourceType: 'Observation',
            id,
            status: 'final',
            code: { coding: [coding] },
            subject: { reference: patientRef },
            effectiveDateTime: date,
            valueString: value,
        };
        return { fullUrl: `urn:uuid:${id}`, resource: obs };
    }

    /**
     * Observation whose code is a text-only CodeableConcept (no coding array).
     * Used for symptoms without a SNOMED mapping — conformant, unlike a
     * fabricated coding with no `system`.
     */
    private static createTextCodedStringObs(
        patientRef: string,
        date: string,
        codeText: string,
        value: string,
    ): BundleEntry {
        const id = uuidv4();
        const obs: Observation = {
            resourceType: 'Observation',
            id,
            status: 'final',
            code: { text: codeText },
            subject: { reference: patientRef },
            effectiveDateTime: date,
            valueString: value,
        };
        return { fullUrl: `urn:uuid:${id}`, resource: obs };
    }

    private static createBooleanObs(
        patientRef: string,
        date: string,
        coding: { system?: string; code: string; display: string },
        value: boolean,
    ): BundleEntry {
        const id = uuidv4();
        const obs: Observation = {
            resourceType: 'Observation',
            id,
            status: 'final',
            code: { coding: [coding] },
            subject: { reference: patientRef },
            effectiveDateTime: date,
            valueBoolean: value,
        };
        return { fullUrl: `urn:uuid:${id}`, resource: obs };
    }
}
