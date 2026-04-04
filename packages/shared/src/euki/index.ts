import type { EukiContent } from './types.js';
import { menstruationContent } from './content/menstruation.js';

export * from './types.js';
export * from './phaseMapping.js';
export * from './symptomMapping.js';

let _content: EukiContent | null = null;

/** Lazy singleton — content is bundled and loaded once. */
export function getEukiContent(): EukiContent {
  if (!_content) {
    _content = menstruationContent;
  }
  return _content;
}
