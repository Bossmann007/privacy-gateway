import type { Classification } from '../domain/types.js';
import { classificationOf } from '../domain/types.js';
import type { Tainted } from '../domain/taint.js';

export type FlowVerdict = { ok: true } | { ok: false; code: string };

export const FLOW_DENIED_UNDECLASSIFIED = 'FLOW_DENIED_UNDECLASSIFIED';

const CROSSES_IN_NATURA: Record<Classification, boolean> = {
  PUBLIC: true,
  INTERNAL: false,
  CONFIDENTIAL: false,
  STRICT: false,
};

export class FlowPolicy {
  canCross(t: Tainted<unknown>): FlowVerdict {
    const label = classificationOf(t.derivedFrom);
    if (CROSSES_IN_NATURA[label]) {
      return { ok: true };
    }
    if (t.declassified === true) {
      return { ok: true };
    }
    return { ok: false, code: FLOW_DENIED_UNDECLASSIFIED };
  }
}
