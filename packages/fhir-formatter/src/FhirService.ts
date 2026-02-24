import type { Bundle, BundleEntry, Observation, Patient } from 'fhir/r4';
import { v4 as uuidv4 } from 'uuid';

/**
 * LOINC and SNOMED CT coding constants for menstrual health observations.
 */
const LOINC_CYCLE_LENGTH = { system: 'http://loinc.org', code: '42798-9', display: 'Cycle Length' } as const;
const LOINC_MENSTRUAL_FLOW = { system: 'http://loinc.org', code: '92656-8', display: 'Menstrual Flow' } as const;
const LOINC_PERIOD_LENGTH = { system: 'http://loinc.org', code: '8339-4', display: 'Birth date' } as const;
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
    }>;
}

/**
 * FhirService — Edge-formatting engine for the Provider Portal.
 *
 * Converts raw Locket JSON (UserConfig + LocketLedger) into an HL7 FHIR R4
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
                const isoDate = `${dateStr}T00:00:00Z`;

                // Menstrual flow → LOINC 92656-8
                if (log.flow) {
                    entries.push(
                        this.createStringObs(patientReference, isoDate, LOINC_MENSTRUAL_FLOW, log.flow),
                    );
                }

                // Symptoms → SNOMED (known) or text-only (unknown)
                if (log.symptoms) {
                    for (const symptom of log.symptoms) {
                        const snomedCode = SYMPTOM_SNOMED_MAP[symptom.toLowerCase()];
                        if (snomedCode) {
                            entries.push(
                                this.createBooleanObs(patientReference, isoDate, snomedCode, true),
                            );
                        } else {
                            entries.push(
                                this.createStringObs(patientReference, isoDate, { code: symptom.toLowerCase(), display: symptom }, symptom),
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
