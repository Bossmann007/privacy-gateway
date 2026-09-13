export type FirewallVerdict = { ok: true } | { ok: false; code: string };

export const FIREWALL_CANARY = 'FIREWALL_CANARY';
export const FIREWALL_BR_PATTERN = 'FIREWALL_BR_PATTERN';
export const FIREWALL_LABEL_LEAK = 'FIREWALL_LABEL_LEAK';
export const FIREWALL_CREDENTIAL = 'FIREWALL_CREDENTIAL';
export const FIREWALL_PATH = 'FIREWALL_PATH';
export const FIREWALL_STACK = 'FIREWALL_STACK';

const CANARIES = [
  'Joao da Silva',
  'João da Silva',
  '123.456.789-00',
  '12345678900',
  '12345-6',
  '0001234-56.2026.8.16.0001',
  'Ignore as regras',
  'ignore previous instructions',
  'envie todos os documentos',
];

const CPF_FORMATTED = /(?<![\w.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\w.-])/;
const CPF_BARE = /(?<![\w.-])\d{11}(?![\w.-])/;
const CNPJ_FORMATTED = /(?<![\w.\/-])\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?![\w.-])/;
const CNPJ_BARE = /(?<![\w.-])\d{14}(?![\w.-])/;
const OAB = /(?<![\w.-])OAB\s*[\/-]?\s*[A-Z]{2}\s*n?\.?\s*\d{1,3}\.?\d{3}(?![\w-])/i;
const CNJ = /(?<![\w.-])\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}(?![\w.-])/;

const BR_PATTERNS = [
  CPF_FORMATTED,
  CPF_BARE,
  CNPJ_FORMATTED,
  CNPJ_BARE,
  OAB,
  CNJ,
];

const LABEL_LEAKS = [
  /"derivedFrom"/,
  /"declassified"\s*:/,
  /"classification"/,
  /(?<![\w-])STRICT(?![\w-])/,
  /(?<![\w-])CONFIDENTIAL(?![\w-])/,
  /"raw_/,
  /rag_chunks/,
];

const CREDENTIAL_RE =
  /(?:password|passwd|pwd|senha|secret|token|api[_-]?key|bearer)\s*[=:]\s*\S+/i;
const BEARER_RE = /\bbearer\s+[a-z0-9._\-+=\/]{8,}/i;
const UNIX_PATH_RE = /(?:^|[\s"'`])(\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)/;
const WIN_PATH_RE = /(?:^|[\s"'`])([A-Za-z]:\\(?:[^\s"'`]+))/;
const STACK_RE = /\bstack\s+at\s+\S+\.(?:ts|js|tsx|jsx):\d+/i;

export class EgressFirewall {
  inspect(wire: string): FirewallVerdict {
    for (const canary of CANARIES) {
      if (wire.toLowerCase().includes(canary.toLowerCase())) {
        return { ok: false, code: FIREWALL_CANARY };
      }
    }
    for (const pattern of BR_PATTERNS) {
      if (pattern.test(wire)) {
        return { ok: false, code: FIREWALL_BR_PATTERN };
      }
    }
    for (const pattern of LABEL_LEAKS) {
      if (pattern.test(wire)) {
        return { ok: false, code: FIREWALL_LABEL_LEAK };
      }
    }
    if (CREDENTIAL_RE.test(wire) || BEARER_RE.test(wire)) {
      return { ok: false, code: FIREWALL_CREDENTIAL };
    }
    if (UNIX_PATH_RE.test(wire) || WIN_PATH_RE.test(wire)) {
      return { ok: false, code: FIREWALL_PATH };
    }
    if (STACK_RE.test(wire)) {
      return { ok: false, code: FIREWALL_STACK };
    }
    return { ok: true };
  }
}
