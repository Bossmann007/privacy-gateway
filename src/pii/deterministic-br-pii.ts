import type { PiiSpan } from '../domain/types.js';

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** CPF check digits (mod-11). */
export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) {
    d1 = 0;
  }
  if (d1 !== Number(digits[9])) {
    return false;
  }
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) {
    d2 = 0;
  }
  return d2 === Number(digits[10]);
}

/** CNPJ check digits (mod-11). */
export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (w1[i] as number);
  }
  let d1 = sum % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  if (d1 !== Number(digits[12])) {
    return false;
  }
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits[i]) * (w2[i] as number);
  }
  let d2 = sum % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return d2 === Number(digits[13]);
}

const CPF_RE =
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_RE =
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const ACCOUNT_RE = /\b\d{4,6}-\d\b/g;
const PERSON_HINT_RE =
  /\b(?:Parte autora|cliente|autor|reu):\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){1,4})/gi;
const PERSON_NAME_RE =
  /\b[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+(?:da|de|do|dos|das)\s+[A-ZÀ-Ÿ][a-zà-ÿ]+|\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){1,3}\b/g;

export class DeterministicBrPii {
  findSpans(text: string): PiiSpan[] {
    const spans: PiiSpan[] = [];

    for (const match of text.matchAll(CPF_RE)) {
      const digits = onlyDigits(match[0]);
      if (digits.length === 11 && match.index !== undefined) {
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'BR_CPF',
        });
      }
    }

    for (const match of text.matchAll(CNPJ_RE)) {
      const digits = onlyDigits(match[0]);
      if (digits.length === 14 && match.index !== undefined) {
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'BR_CNPJ',
        });
      }
    }

    for (const match of text.matchAll(ACCOUNT_RE)) {
      if (match.index === undefined) {
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'BR_ACCOUNT',
      });
    }

    for (const match of text.matchAll(PERSON_HINT_RE)) {
      const name = match[1];
      if (!name || match.index === undefined) {
        continue;
      }
      const nameStart = match.index + match[0].indexOf(name);
      spans.push({
        start: nameStart,
        end: nameStart + name.length,
        type: 'PERSON',
      });
    }

    for (const match of text.matchAll(PERSON_NAME_RE)) {
      if (match.index === undefined) {
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'PERSON',
      });
    }

    return mergeSpans(spans);
  }
}

function mergeSpans(spans: PiiSpan[]): PiiSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PiiSpan[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (!last || span.start >= last.end) {
      out.push(span);
      continue;
    }
    if (span.end > last.end) {
      last.end = span.end;
      last.type = `${last.type}+${span.type}`;
    }
  }
  return out;
}
