import type { AuditLog } from '../audit/audit-log.js';
import type { Classification } from '../domain/types.js';
import type { Tainted } from '../domain/taint.js';
import { markDeclassified, tainted } from '../domain/taint.js';

export const AUTHORIZED_RELEASES = {
  intern_brief: { reason: 'role_capped_intern_release' },
  associate_brief: { reason: 'role_capped_associate_release' },
  partner_brief: { reason: 'role_capped_partner_release' },
} as const;

export type ReleaseKind = keyof typeof AUTHORIZED_RELEASES;

export function isAuthorizedReleaseKind(kind: string): kind is ReleaseKind {
  return Object.prototype.hasOwnProperty.call(AUTHORIZED_RELEASES, kind);
}

export function authorizeRelease<T>(
  kind: string,
  value: T,
  sourceLabel: Classification,
  audit?: AuditLog,
  userId = 'office',
): Tainted<T> {
  if (!isAuthorizedReleaseKind(kind)) {
    audit?.append({
      action: 'declassify_denied',
      userId,
      outcome: 'deny',
      reason: `${sourceLabel}->unauthorized_release`,
    });
    return tainted(value, sourceLabel);
  }
  const spec = AUTHORIZED_RELEASES[kind];
  audit?.append({
    action: 'declassify_authorized',
    userId,
    outcome: 'allow',
    reason: `${sourceLabel}->${kind}:${spec.reason}`,
  });
  return markDeclassified(tainted(value, sourceLabel));
}
