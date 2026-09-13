import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import { Declassifier } from '../src/declassify/declassifier.js';
import { Presenter } from '../src/declassify/presenter.js';
import type { SafeDTO } from '../src/domain/safe-dto.js';
import { validateSafeDto } from '../src/domain/safe-dto.js';
import { tainted } from '../src/domain/taint.js';
import type { CaseRecord } from '../src/domain/types.js';
import { VirtualOffice } from '../src/office/virtual-office.js';
import { FlowPolicy } from '../src/policy/flow-policy.js';
import { CaseFixtureStore } from '../src/store/case-fixture-store.js';
import {
  ADV,
  FORBIDDEN,
  INTERN,
  OTHER_INTERN,
  PUBLIC_ERROR,
  SOCIO,
  UnmarkedDeclassifier,
  mcpFor,
} from './helpers/adversarial-setup.js';

describe('SafeDTO v3 flow taint and firewall', () => {
  it('STRICT field paraphrase is denied when not declassified', () => {
    const flow = new FlowPolicy();
    const denied = flow.canCross(tainted('paraphrase', 'STRICT'));
    expect(denied).toEqual({ ok: false, code: 'FLOW_DENIED_UNDECLASSIFIED' });

    const store = CaseFixtureStore.fromDefaultFixture();
    const raw = store.getAuthorizedSummary(ADV, 'case-banco-001');
    if (!raw) throw new Error('raw');
    expect(() =>
      new UnmarkedDeclassifier('STRICT').declassify({
        raw,
        sessionId: 'ofs_test00000001',
        role: 'advogado',
      }),
    ).toThrow('FLOW_DENIED_UNDECLASSIFIED');

    const mcp = mcpFor(
      ADV,
      new VirtualOffice({ declassifier: new UnmarkedDeclassifier('STRICT') }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('Joao');
  });

  it('a new fixture field never reaches the SafeDTO', () => {
    const record: CaseRecord = {
      id: 'case-novo-001',
      title: 'Caso ficticio com campo novo',
      allowedUserIds: ['adv-ana'],
      allowedRoles: ['advogado'],
      documents: [
        {
          id: 'doc-novo',
          classification: 'CONFIDENTIAL',
          fields: [
            {
              name: 'tese_interna',
              value: 'Tese interna: alegar onerosidade excessiva com base em precedente da 1a Camara.',
              classification: 'CONFIDENTIAL',
            },
            {
              name: 'campo_novo',
              value: 'CANARIO_CAMPO_NOVO',
              classification: 'PUBLIC',
            },
          ],
        },
      ],
    };
    const store = new CaseFixtureStore([record]);
    const raw = store.getAuthorizedSummary(ADV, 'case-novo-001');
    if (!raw) throw new Error('raw');
    const presented = new Presenter().read(raw);
    expect(presented.map((f) => f.name)).toEqual(['tese_interna']);
    expect(presented.map((f) => f.text.value).join('|')).not.toContain(
      'CANARIO_CAMPO_NOVO',
    );

    const mcp = mcpFor(ADV, new VirtualOffice({ store }));
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-novo-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(false);
    if (out.isError) return;
    expect(JSON.stringify(out.structuredContent)).not.toContain(
      'CANARIO_CAMPO_NOVO',
    );
    expect(out.content[0].text).not.toContain('CANARIO_CAMPO_NOVO');
    expect(out.content[0].text).not.toContain('campo_novo');
  });

  it('CONFIDENTIAL taint without the declassified flag cannot cross', () => {
    const flow = new FlowPolicy();
    expect(flow.canCross(tainted('resumo', 'CONFIDENTIAL'))).toEqual({
      ok: false,
      code: 'FLOW_DENIED_UNDECLASSIFIED',
    });
    expect(flow.canCross(tainted('resumo', 'CONFIDENTIAL', true))).toEqual({
      ok: true,
    });
    expect(flow.canCross(tainted('resumo', 'PUBLIC'))).toEqual({ ok: true });

    const mcp = mcpFor(
      SOCIO,
      new VirtualOffice({
        declassifier: new UnmarkedDeclassifier('CONFIDENTIAL'),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
  });

  it('firewall blocks a forbidden literal that the Declassifier approved', () => {
    class BuggyDeclassifier extends Declassifier {
      override declassify(args: { sessionId: string }): SafeDTO {
        return {
          schemaVersion: '1',
          sessionId: args.sessionId,
          releaseId: 'rel_bug0001',
          summary: 'Resumo com CNPJ 12.345.678/0001-95 vazado por bug.',
          decisions: [],
          tasks: [],
          safeReferences: [],
          warnings: [],
        };
      }
    }
    const codes: string[] = [];
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({ declassifier: new BuggyDeclassifier() }),
      { onFirewallBlock: (code) => codes.push(code) },
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('12.345.678');
    expect(codes).toEqual(['FIREWALL_BR_PATTERN']);
  });

  it('taint labels and provenance never appear in the wire bytes', () => {
    const mcp = mcpFor(SOCIO);
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    if (out.isError) throw new Error('summary');
    const wire = out.content[0].text;
    expect(wire).not.toContain('derivedFrom');
    expect(wire).not.toContain('"declassified":');
    expect(wire).not.toContain('classification');
    expect(wire).not.toContain('STRICT');
    expect(wire).not.toContain('CONFIDENTIAL');
  });

  it('session user mismatch denied', () => {
    const office = new VirtualOffice();
    const entered = mcpFor(ADV, office).callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcpFor(SOCIO, office).callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
  });
});
