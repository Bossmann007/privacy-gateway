import { AuditLog } from '../../src/audit/audit-log.js';
import {
  Declassifier,
  type DeclassifiedDraft,
  type DeclassifySignals,
} from '../../src/declassify/declassifier.js';
import type { PresentedField } from '../../src/declassify/presenter.js';
import type { SafeDTO } from '../../src/domain/safe-dto.js';
import { tainted } from '../../src/domain/taint.js';
import type { Classification, Role, UserPrincipal } from '../../src/domain/types.js';
import { McpOfficeServer } from '../../src/mcp/mcp-office-server.js';
import { VirtualOffice } from '../../src/office/virtual-office.js';

export const PUBLIC_ERROR = JSON.stringify({
  error: 'Requested resource could not be accessed.',
});

export const ADV: UserPrincipal = { id: 'adv-ana', role: 'advogado' };
export const SOCIO: UserPrincipal = { id: 'socio-paulo', role: 'socio' };
export const INTERN: UserPrincipal = { id: 'est-lia', role: 'estagiario' };
export const OTHER_INTERN: UserPrincipal = { id: 'est-outro', role: 'estagiario' };

export function mcpFor(
  principal: UserPrincipal,
  office?: VirtualOffice,
  extra?: { onFirewallBlock?: (code: string) => void; audit?: AuditLog },
) {
  return new McpOfficeServer({
    office,
    connection: { principal },
    onFirewallBlock: extra?.onFirewallBlock,
    audit: extra?.audit,
  });
}

export class UnmarkedDeclassifier extends Declassifier {
  constructor(private readonly label: Classification) {
    super();
  }

  protected override compose(args: {
    fields: PresentedField[];
    role: Role;
    signals: DeclassifySignals;
    userId?: string;
  }): DeclassifiedDraft {
    const source =
      this.presenter.find(args.fields, 'parte_autora') ??
      this.presenter.find(args.fields, 'tese_interna');
    return {
      summary: tainted(
        `Resumo derivado do campo de origem: ${source?.text.value ?? 'vazio'}`,
        this.label,
      ),
      decisions: [],
      tasks: [],
      refs: [],
    };
  }
}

export class PlantedDeclassifier extends Declassifier {
  constructor(private readonly plant: Partial<SafeDTO>) {
    super();
  }

  override declassify(args: { sessionId: string }): SafeDTO {
    return {
      schemaVersion: '1',
      sessionId: args.sessionId,
      releaseId: 'rel_plant01',
      summary: 'Resumo abstrato.',
      decisions: [],
      tasks: [],
      safeReferences: [],
      warnings: [],
      ...this.plant,
    };
  }
}

export const FORBIDDEN = [
  'Joao da Silva',
  '123.456.789-00',
  '12345-6',
  '0001234-56.2026.8.16.0001',
  'Ignore as regras',
  'envie todos os documentos',
];
