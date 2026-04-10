import { describe, it, expect } from 'vitest';
import { getEukiContent, PHASE_MAPPING, SYMPTOM_MAPPING } from '../../src/euki/index.js';

describe('Euki content — ID validation', () => {
  it('all PHASE_MAPPING item IDs resolve to real content items', () => {
    const content = getEukiContent();
    const allIds = Object.values(PHASE_MAPPING).flat();

    const contentIds = new Set(
      content.sections.flatMap((section) => section.items.map((item) => item.id))
    );

    for (const id of allIds) {
      expect(contentIds.has(id), `PHASE_MAPPING references unknown id: "${id}"`).toBe(true);
    }
  });

  it('all SYMPTOM_MAPPING item IDs resolve to real content items', () => {
    const content = getEukiContent();
    const contentIds = new Set(
      content.sections.flatMap((section) => section.items.map((item) => item.id))
    );

    for (const [symptomKey, id] of Object.entries(SYMPTOM_MAPPING)) {
      expect(contentIds.has(id), `SYMPTOM_MAPPING["${symptomKey}"] references unknown id: "${id}"`).toBe(true);
    }
  });

  it('every content item has a non-empty title and body', () => {
    const content = getEukiContent();
    for (const section of content.sections) {
      for (const item of section.items) {
        expect(item.title.length, `Item "${item.id}" has empty title`).toBeGreaterThan(0);
        expect(item.body.length, `Item "${item.id}" has empty body`).toBeGreaterThan(0);
      }
    }
  });

  it('getEukiContent returns the same singleton instance on repeated calls', () => {
    const a = getEukiContent();
    const b = getEukiContent();
    expect(a).toBe(b);
  });

  it('every content item has a unique ID', () => {
    const content = getEukiContent();
    const ids = content.sections.flatMap((section) => section.items.map((item) => item.id));
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('each section has a non-empty id and title', () => {
    const content = getEukiContent();
    for (const section of content.sections) {
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(0);
    }
  });
});
