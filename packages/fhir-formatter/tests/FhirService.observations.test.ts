import { describe, it, expect } from 'vitest';
import { FhirService } from '../src/FhirService.js';
import type { Observation, Patient } from 'fhir/r4';

/**
 * Helper to extract all Observation resources from a Bundle.
 */
function getObservations(bundle: ReturnType<typeof FhirService.generateClinicalBundle>): Observation[] {
    return bundle.entry!
        .filter(e => (e.resource as any)?.resourceType === 'Observation')
        .map(e => e.resource as Observation);
}

/**
 * Helper to find an Observation by its coding code.
 */
function findObsByCode(observations: Observation[], code: string): Observation | undefined {
    return observations.find(obs =>
        obs.code?.coding?.some(c => c.code === code),
    );
}

describe('FhirService — LOINC and SNOMED Observations', () => {
    const fullPayload = {
        config: { lastPeriodDate: '2026-02-01', bleedLength: 5, cycleLength: 28 },
        ledger: {
            '2026-02-23': { flow: 'heavy', symptoms: ['cramps', 'fatigue'] },
        },
    };

    it('should map cycleLength to LOINC 42798-9 with valueQuantity in days', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const cycleLengthObs = findObsByCode(observations, '42798-9');

        expect(cycleLengthObs).toBeDefined();
        expect(cycleLengthObs!.code.coding![0].system).toBe('http://loinc.org');
        expect(cycleLengthObs!.code.coding![0].display).toBe('Cycle Length');
        expect(cycleLengthObs!.valueQuantity).toBeDefined();
        expect(cycleLengthObs!.valueQuantity!.value).toBe(28);
        expect(cycleLengthObs!.valueQuantity!.unit).toBe('days');
    });

    it('should map bleedLength to LOINC 8339-4 with valueQuantity in days', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const periodObs = findObsByCode(observations, '8339-4');

        expect(periodObs).toBeDefined();
        expect(periodObs!.valueQuantity).toBeDefined();
        expect(periodObs!.valueQuantity!.value).toBe(5);
        expect(periodObs!.valueQuantity!.unit).toBe('days');
    });

    it('should map menstrual flow to LOINC 92656-8 with valueString', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const flowObs = findObsByCode(observations, '92656-8');

        expect(flowObs).toBeDefined();
        expect(flowObs!.code.coding![0].system).toBe('http://loinc.org');
        expect(flowObs!.code.coding![0].display).toBe('Menstrual Flow');
        expect(flowObs!.valueString).toBe('heavy');
        expect(flowObs!.effectiveDateTime).toBe('2026-02-23T00:00:00Z');
    });

    it('should map cramps to SNOMED CT 268953000 with valueBoolean true', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const crampsObs = findObsByCode(observations, '268953000');

        expect(crampsObs).toBeDefined();
        expect(crampsObs!.code.coding![0].system).toBe('http://snomed.info/sct');
        expect(crampsObs!.code.coding![0].display).toBe('Dysmenorrhea');
        expect(crampsObs!.valueBoolean).toBe(true);
    });

    it('should map unknown symptoms as text-only Observations with valueString', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const fatigueObs = findObsByCode(observations, 'fatigue');

        expect(fatigueObs).toBeDefined();
        expect(fatigueObs!.code.coding![0].system).toBeUndefined();
        expect(fatigueObs!.valueString).toBe('fatigue');
    });

    it('should set all Observations to status "final"', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);

        for (const obs of observations) {
            expect(obs.status).toBe('final');
        }
    });

    it('should link all Observations to the Patient resource via subject.reference', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const patientEntry = bundle.entry![0];
        const patientRef = patientEntry.fullUrl;
        const observations = getObservations(bundle);

        for (const obs of observations) {
            expect(obs.subject?.reference).toBe(patientRef);
        }
    });

    it('should set Patient identifier to the DID URI', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const patient = bundle.entry![0].resource as Patient;

        expect(patient.identifier).toBeDefined();
        expect(patient.identifier!.length).toBe(1);
        expect(patient.identifier![0].system).toBe('urn:ietf:rfc:3986');
        expect(patient.identifier![0].value).toBe('did:locket:alice');
    });

    it('should support periodLength as an alias for bleedLength', () => {
        const payload = {
            config: { lastPeriodDate: '2026-02-01', periodLength: 7, cycleLength: 30 },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', payload);
        const observations = getObservations(bundle);
        const periodObs = findObsByCode(observations, '8339-4');

        expect(periodObs).toBeDefined();
        expect(periodObs!.valueQuantity!.value).toBe(7);
    });
});
