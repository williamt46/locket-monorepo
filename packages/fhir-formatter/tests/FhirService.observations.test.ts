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

    it('should map bleedLength to LOINC 3144-3 (Last menstrual period duration) with valueQuantity in days', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const periodObs = findObsByCode(observations, '3144-3');

        expect(periodObs).toBeDefined();
        expect(periodObs!.code.coding![0].system).toBe('http://loinc.org');
        expect(periodObs!.code.coding![0].display).toBe('Last menstrual period duration');
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

    it('should map unknown symptoms as text-only CodeableConcepts with valueString', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', fullPayload);
        const observations = getObservations(bundle);
        const fatigueObs = observations.find(o => o.code.text === 'fatigue');

        expect(fatigueObs).toBeDefined();
        expect(fatigueObs!.code.coding).toBeUndefined();
        expect(fatigueObs!.valueString).toBe('fatigue');
    });

    it('should map ledger temperature to LOINC 8310-5 (Body temperature) in Cel', () => {
        const payload = {
            ledger: { '2026-02-23': { temperature: 36.62 } },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:bbt', payload);
        const observations = getObservations(bundle);
        const tempObs = findObsByCode(observations, '8310-5');

        expect(tempObs).toBeDefined();
        expect(tempObs!.code.coding![0].system).toBe('http://loinc.org');
        expect(tempObs!.code.coding![0].display).toBe('Body temperature');
        expect(tempObs!.valueQuantity!.value).toBe(36.62);
        expect(tempObs!.valueQuantity!.unit).toBe('Cel');
        expect(tempObs!.effectiveDateTime).toBe('2026-02-23T00:00:00Z');
    });

    // Snapshot-pin of every emitted code. If this test fails, a coding
    // constant changed — that is a clinical-facing change and must be
    // deliberate (see eng review 2026-07-18: 8339-4 shipped wrong for
    // months because nothing pinned it).
    it('pins the exact code constants the bundle emits', () => {
        const payload = {
            config: { cycleLength: 28, bleedLength: 5 },
            ledger: { '2026-02-23': { flow: 'heavy', symptoms: ['cramps'], temperature: 36.5 } },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:pin', payload);
        const observations = getObservations(bundle);
        const emitted = observations
            .map(o => o.code.coding?.[0])
            .filter((c): c is NonNullable<typeof c> => c !== undefined)
            .map(c => `${c.system}|${c.code}|${c.display}`)
            .sort();

        expect(emitted).toEqual([
            'http://loinc.org|3144-3|Last menstrual period duration',
            'http://loinc.org|42798-9|Cycle Length',
            'http://loinc.org|8310-5|Body temperature',
            'http://loinc.org|92656-8|Menstrual Flow',
            'http://snomed.info/sct|268953000|Dysmenorrhea',
        ].sort());
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
        const periodObs = findObsByCode(observations, '3144-3');

        expect(periodObs).toBeDefined();
        expect(periodObs!.valueQuantity!.value).toBe(7);
    });
});
