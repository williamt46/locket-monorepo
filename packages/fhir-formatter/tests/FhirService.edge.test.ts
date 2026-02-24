import { describe, it, expect } from 'vitest';
import { FhirService } from '../src/FhirService.js';
import type { Observation, Patient } from 'fhir/r4';

describe('FhirService — Edge Cases', () => {
    it('should produce a Bundle with only Patient when payload is empty', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:empty', {});

        expect(bundle.resourceType).toBe('Bundle');
        expect(bundle.type).toBe('collection');
        expect(bundle.entry!.length).toBe(1);

        const patient = bundle.entry![0].resource as Patient;
        expect(patient.resourceType).toBe('Patient');
    });

    it('should handle missing config gracefully (ledger-only payload)', () => {
        const payload = {
            ledger: {
                '2026-02-23': { flow: 'light' },
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:noconfig', payload);

        // 1 Patient + 1 flow Observation
        expect(bundle.entry!.length).toBe(2);

        const obs = bundle.entry![1].resource as Observation;
        expect(obs.code.coding![0].code).toBe('92656-8');
        expect(obs.valueString).toBe('light');
    });

    it('should handle missing ledger gracefully (config-only payload)', () => {
        const payload = {
            config: { cycleLength: 28, bleedLength: 5 },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:noledger', payload);

        // 1 Patient + 2 config Observations
        expect(bundle.entry!.length).toBe(3);
    });

    it('should handle an empty ledger object', () => {
        const payload = {
            config: { cycleLength: 28 },
            ledger: {},
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:emptyledger', payload);

        // 1 Patient + 1 cycleLength Observation
        expect(bundle.entry!.length).toBe(2);
    });

    it('should handle a ledger entry with no flow and no symptoms', () => {
        const payload = {
            ledger: {
                '2026-02-23': {},
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:sparseday', payload);

        // Only Patient (no observations for empty day)
        expect(bundle.entry!.length).toBe(1);
    });

    it('should handle multiple dates correctly', () => {
        const payload = {
            ledger: {
                '2026-02-21': { flow: 'light' },
                '2026-02-22': { flow: 'medium' },
                '2026-02-23': { flow: 'heavy', symptoms: ['cramps'] },
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:multiday', payload);

        // 1 Patient + 3 flow + 1 cramps = 5
        expect(bundle.entry!.length).toBe(5);
    });

    it('should handle unknown symptoms as text-only Observations', () => {
        const payload = {
            ledger: {
                '2026-02-23': { symptoms: ['headache', 'bloating', 'mood swings'] },
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:unknownsymptoms', payload);

        // 1 Patient + 3 text Observations
        expect(bundle.entry!.length).toBe(4);

        const observations = bundle.entry!.slice(1).map(e => e.resource as Observation);
        for (const obs of observations) {
            expect(obs.valueString).toBeDefined();
            // Unknown symptoms should NOT have a code system
            expect(obs.code.coding![0].system).toBeUndefined();
        }
    });

    it('should handle mixed known and unknown symptoms', () => {
        const payload = {
            ledger: {
                '2026-02-23': { symptoms: ['cramps', 'nausea'] },
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:mixed', payload);

        // 1 Patient + 1 SNOMED cramps + 1 text nausea = 3
        expect(bundle.entry!.length).toBe(3);

        const observations = bundle.entry!.slice(1).map(e => e.resource as Observation);

        // cramps → SNOMED boolean
        const crampsObs = observations.find(o => o.code.coding![0].code === '268953000');
        expect(crampsObs).toBeDefined();
        expect(crampsObs!.valueBoolean).toBe(true);

        // nausea → text string
        const nauseaObs = observations.find(o => o.code.coding![0].code === 'nausea');
        expect(nauseaObs).toBeDefined();
        expect(nauseaObs!.valueString).toBe('nausea');
    });

    it('should handle "Cramps" with different casing (case-insensitive mapping)', () => {
        const payload = {
            ledger: {
                '2026-02-23': { symptoms: ['Cramps', 'CRAMPS'] },
            },
        };
        const bundle = FhirService.generateClinicalBundle('did:locket:casing', payload);

        const observations = bundle.entry!.slice(1).map(e => e.resource as Observation);

        // Both should map to SNOMED 268953000
        for (const obs of observations) {
            expect(obs.code.coding![0].code).toBe('268953000');
            expect(obs.valueBoolean).toBe(true);
        }
    });
});
