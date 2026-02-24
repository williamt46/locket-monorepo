import { describe, it, expect } from 'vitest';
import { FhirService } from '../src/FhirService.js';
import type { Bundle, Patient, Observation } from 'fhir/r4';

describe('FhirService — Bundle Structure', () => {
    const basePayload = {
        config: { lastPeriodDate: '2026-02-01', bleedLength: 5, cycleLength: 28 },
        ledger: {
            '2026-02-23': { flow: 'heavy', symptoms: ['cramps'] },
        },
    };

    it('should return a Bundle with resourceType "Bundle" and type "collection"', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', basePayload);

        expect(bundle.resourceType).toBe('Bundle');
        expect(bundle.type).toBe('collection');
    });

    it('should include a Bundle id and timestamp', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', basePayload);

        expect(bundle.id).toBeDefined();
        expect(typeof bundle.id).toBe('string');
        expect(bundle.id!.length).toBeGreaterThan(0);
        expect(bundle.timestamp).toBeDefined();
        expect(typeof bundle.timestamp).toBe('string');
    });

    it('should have entries with urn:uuid: fullUrl prefix', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', basePayload);

        expect(bundle.entry).toBeDefined();
        expect(bundle.entry!.length).toBeGreaterThan(0);

        for (const entry of bundle.entry!) {
            expect(entry.fullUrl).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
        }
    });

    it('should contain a Patient resource as the first entry', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', basePayload);
        const firstEntry = bundle.entry![0];
        const patient = firstEntry.resource as Patient;

        expect(patient.resourceType).toBe('Patient');
        expect(patient.active).toBe(true);
    });

    it('should generate unique Bundle ids across calls', () => {
        const b1 = FhirService.generateClinicalBundle('did:locket:alice', basePayload);
        const b2 = FhirService.generateClinicalBundle('did:locket:alice', basePayload);

        expect(b1.id).not.toBe(b2.id);
    });

    it('should contain Patient + config Observations + ledger Observations', () => {
        const bundle = FhirService.generateClinicalBundle('did:locket:alice', basePayload);

        // 1 Patient + 2 config obs (cycleLength, bleedLength) + 1 flow + 1 cramps = 5
        expect(bundle.entry!.length).toBe(5);
    });
});
