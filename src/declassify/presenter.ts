import type { CaseDocument, Classification, RawContext } from '../domain/types.js';
import { classificationOf, maxClassification } from '../domain/types.js';
import type { Tainted } from '../domain/taint.js';
import { tainted } from '../domain/taint.js';

export const PRESENTER_ALLOWLIST = [
  'parte_autora',
  'tese_interna',
  'fundamentacao',
] as const;

export type PresentedFieldName = (typeof PRESENTER_ALLOWLIST)[number];

export type PresentedField = {
  name: PresentedFieldName;
  text: Tainted<string>;
};

function isAllowlisted(name: string): name is PresentedFieldName {
  return (PRESENTER_ALLOWLIST as readonly string[]).includes(name);
}

function fieldLabel(doc: CaseDocument, fieldLabelValue: Classification | undefined): Classification {
  return maxClassification(
    classificationOf(doc.classification),
    classificationOf(fieldLabelValue),
  );
}

export class Presenter {
  read(raw: RawContext): PresentedField[] {
    const out: PresentedField[] = [];
    for (const doc of raw.documents) {
      for (const field of doc.fields) {
        if (!isAllowlisted(field.name)) {
          continue;
        }
        out.push({
          name: field.name,
          text: tainted(field.value, fieldLabel(doc, field.classification)),
        });
      }
    }
    return out;
  }

  find(fields: PresentedField[], name: PresentedFieldName): PresentedField | undefined {
    return fields.find((f) => f.name === name);
  }
}
