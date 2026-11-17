import { describe, expect, it } from 'vitest';
import type { SafeDTO } from '../src/domain/safe-dto.js';
import { validateSafeDto } from '../src/domain/safe-dto.js';

describe('SafeDTO schema depth', () => {
  it('rejects an unknown field nested inside a list item', () => {
    const dto = {
      schemaVersion: '1',
      sessionId: 'ofs_abc123',
      releaseId: 'rel_abc123',
      summary: 'Resumo abstrato.',
      decisions: [{ id: 'dec_1', text: 'ok', leaked: 'segredo' }],
      tasks: [],
      safeReferences: [],
      warnings: [],
    };
    const checked = validateSafeDto(dto);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.reason).toBe('unknown_field:decisions.leaked');
    }
  });

  it('rejects a list item with a wrong enum value', () => {
    const dto = {
      schemaVersion: '1',
      sessionId: 'ofs_abc123',
      releaseId: 'rel_abc123',
      summary: 'Resumo abstrato.',
      decisions: [],
      tasks: [{ id: 't1', text: 'ok', status: 'raw' }],
      safeReferences: [],
      warnings: [],
    };
    const checked = validateSafeDto(dto);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.reason).toBe('bad_field:tasks.status');
    }
  });
});

