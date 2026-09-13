import type { Classification } from './types.js';
import { classificationOf, maxClassification } from './types.js';

export type Tainted<T> = {
  value: T;
  derivedFrom: Classification;
  declassified: boolean;
};

export function tainted<T>(
  value: T,
  derivedFrom: Classification,
  declassified = false,
): Tainted<T> {
  return {
    value,
    derivedFrom: classificationOf(derivedFrom),
    declassified,
  };
}

export function deriveTaint(parts: Tainted<unknown>[]): Classification {
  if (parts.length === 0) {
    return 'STRICT';
  }
  let label: Classification = 'PUBLIC';
  for (const part of parts) {
    label = maxClassification(label, classificationOf(part.derivedFrom));
  }
  return label;
}

export function markDeclassified<T>(t: Tainted<T>): Tainted<T> {
  return { ...t, declassified: true };
}
