import { describe, expect, it } from 'vitest';
import { DeterministicBrPii } from '../src/pii/deterministic-br-pii.js';

const pii = new DeterministicBrPii();

describe('DeterministicBrPii legal and contact spans', () => {
  it('detects OAB, CNJ, email, and BR phone', () => {
    const text =
      'Contato OAB/PR 12.345 via nome@escritorio.example.com e (41) 98888-7777. Processo 0001234-56.2026.8.16.0001.';
    const types = pii.findSpans(text).map((s) => s.type);
    expect(types).toEqual(
      expect.arrayContaining(['BR_OAB', 'BR_CNJ', 'EMAIL', 'BR_PHONE']),
    );
  });

  it('emits CPF and CNPJ spans only when check digits are valid', () => {
    const valid = pii
      .findSpans(
        'CPF 123.456.789-09 e 529.982.247-25 CNPJ 11.222.333/0001-81',
      )
      .map((s) => s.type);
    expect(valid.filter((t) => t === 'BR_CPF')).toHaveLength(2);
    expect(valid).toContain('BR_CNPJ');

    const junk = pii
      .findSpans('CPF 111.111.111-11 e 123.456.789-00 CNPJ 00.000.000/0000-00')
      .map((s) => s.type);
    expect(junk).not.toContain('BR_CPF');
    expect(junk).not.toContain('BR_CNPJ');
  });
});
