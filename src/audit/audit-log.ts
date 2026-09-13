import type { AuditEvent } from '../domain/types.js';

export class AuditLog {
  private readonly events: AuditEvent[] = [];
  private failNext = false;

  failNextWrite(): void {
    this.failNext = true;
  }

  append(event: Omit<AuditEvent, 'ts'>): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('audit_write_failed');
    }
    const serialized = JSON.stringify(event);
    if (containsCpfShapedData(serialized)) {
      throw new Error('audit_contains_cpf_shaped_data');
    }
    this.events.push({ ...event, ts: new Date().toISOString() });
  }

  all(): readonly AuditEvent[] {
    return this.events;
  }
}

const CPF_FORMATTED = /(?<![\w.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\w.-])/;
const CPF_BARE = /(?<![\w.-])\d{11}(?![\w.-])/;

/**
 * Opaque identifiers such as ofs_1234567890ab embed digit runs. Token boundaries
 * keep those out of the CPF check so a random id cannot deny a valid release.
 */
function containsCpfShapedData(serialized: string): boolean {
  return CPF_FORMATTED.test(serialized) || CPF_BARE.test(serialized);
}
