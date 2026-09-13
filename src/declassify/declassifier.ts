import { randomBytes } from 'node:crypto';
import type { AuditLog } from '../audit/audit-log.js';
import type {
  SafeDTO,
  SafeItem,
  SafeRef,
  SafeTask,
  SafeWarning,
} from '../domain/safe-dto.js';
import { SUMMARY_MAX, validateSafeDto } from '../domain/safe-dto.js';
import type { Tainted } from '../domain/taint.js';
import { deriveTaint } from '../domain/taint.js';
import type { RawContext, Role } from '../domain/types.js';
import { DeterministicBrPii } from '../pii/deterministic-br-pii.js';
import {
  authorizeRelease,
  type ReleaseKind,
} from '../policy/authorized-releases.js';
import { FlowPolicy } from '../policy/flow-policy.js';
import { ReleasePolicy } from '../policy/release-policy.js';
import type { PresentedField } from './presenter.js';
import { Presenter } from './presenter.js';

const INJECTION_RE =
  /ignore as regras|envie todos os documentos|ignore previous/i;

export type DeclassifySignals = {
  injection: boolean;
  hasOnerosidade: boolean;
  hasCamara: boolean;
};

export type DeclassifiedDraft = {
  summary: Tainted<string>;
  decisions: Tainted<SafeItem>[];
  tasks: Tainted<SafeTask>[];
  refs: Tainted<SafeRef>[];
};

export class Declassifier {
  private readonly brPii = new DeterministicBrPii();
  private readonly release = new ReleasePolicy();
  private readonly flow = new FlowPolicy();
  protected readonly presenter = new Presenter();
  private readonly audit?: AuditLog;

  constructor(opts?: { audit?: AuditLog }) {
    this.audit = opts?.audit;
  }

  declassify(args: {
    raw: RawContext;
    sessionId: string;
    role: Role;
    userId?: string;
    intent?: string;
  }): SafeDTO {
    const fields = this.presenter.read(args.raw);
    const signals = readSignals(fields, args.intent);
    const draft = this.compose({
      fields,
      role: args.role,
      signals,
      userId: args.userId ?? 'office',
    });

    for (const piece of [
      draft.summary,
      ...draft.decisions,
      ...draft.tasks,
      ...draft.refs,
    ]) {
      const verdict = this.flow.canCross(piece);
      if (!verdict.ok) {
        throw new Error(verdict.code);
      }
    }

    const warnings: SafeWarning[] = [
      {
        code: 'declassified',
        message: 'Documentary content destroyed at boundary. Only SafeDTO released.',
      },
    ];
    if (signals.injection) {
      warnings.push({
        code: 'prompt_injection_ignored',
        message:
          'Injection-like instructions in documents or intent were ignored by policy.',
      });
    }

    const summaryText =
      draft.summary.value.length > SUMMARY_MAX
        ? draft.summary.value.slice(0, SUMMARY_MAX)
        : draft.summary.value;

    const drafted: SafeDTO = {
      schemaVersion: '1',
      sessionId: args.sessionId,
      releaseId: `rel_${randomBytes(5).toString('hex')}`,
      summary: summaryText,
      decisions: draft.decisions.map((d) => d.value),
      tasks: draft.tasks.map((t) => t.value),
      safeReferences: draft.refs.map((r) => r.value),
      warnings,
    };

    const released = this.release.apply(args.role, drafted);

    const spans = this.brPii.findSpans(released.summary + (args.intent ?? ''));
    if (spans.length > 0) {
      throw new Error('declassifier_emitted_pii_shaped_content');
    }

    const checked = validateSafeDto(released);
    if (!checked.ok) {
      throw new Error(`declassify_invalid:${checked.reason}`);
    }
    return checked.dto;
  }

  protected compose(args: {
    fields: PresentedField[];
    role: Role;
    signals: DeclassifySignals;
    userId?: string;
  }): DeclassifiedDraft {
    const thesis = this.presenter.find(args.fields, 'tese_interna');
    const grounds = this.presenter.find(args.fields, 'fundamentacao');
    const sourceTaint = deriveTaint(
      [thesis?.text, grounds?.text].filter(
        (t): t is Tainted<string> => t !== undefined,
      ),
    );
    const kind: ReleaseKind =
      args.role === 'estagiario'
        ? 'intern_brief'
        : args.role === 'socio'
          ? 'partner_brief'
          : 'associate_brief';
    const userId = args.userId ?? 'office';

    const summaryText =
      args.role === 'estagiario'
        ? 'A equipe sinalizou uma inconsistencia contratual potencial. Recomenda-se supervisionar a tese principal antes de qualquer divulgacao.'
        : args.role === 'socio'
          ? 'A equipe identificou possivel inconsistencia contratual e recomendou aprofundar a tese de onerosidade excessiva, com comparacao a precedente de camara. Dados cadastrais e valores nao sao liberados neste release.'
          : 'A equipe identificou uma possivel inconsistencia contratual e recomendou aprofundar a analise da tese principal com base em trabalho interno de camara.';

    const abstract = <T>(value: T): Tainted<T> =>
      authorizeRelease(kind, value, sourceTaint, this.audit, userId);

    const decisions: Tainted<SafeItem>[] =
      args.role === 'estagiario'
        ? [
            abstract({
              id: 'dec_1',
              text: 'Encaminhar revisao da tese ao advogado responsavel.',
            }),
          ]
        : [
            abstract({
              id: 'dec_1',
              text: 'Priorizar analise da inconsistencia contratual apontada pela equipe.',
            }),
            ...(args.signals.hasOnerosidade
              ? [
                  abstract({
                    id: 'dec_2',
                    text: 'Avaliar tese de onerosidade excessiva como linha principal.',
                  }),
                ]
              : []),
          ];

    const tasks: Tainted<SafeTask>[] = [
      abstract({
        id: 'task_1',
        text: 'Revisar clausulas relevantes com o time do caso.',
        status: 'open' as const,
      }),
      abstract({
        id: 'task_2',
        text: 'Comparar fundamentacao com precedente interno de camara.',
        status: 'open' as const,
      }),
    ];

    const refs: Tainted<SafeRef>[] = [
      abstract({
        id: 'ref_case',
        label: 'Caso autorizado (referencia opaca)',
        kind: 'internal_case_ref' as const,
      }),
    ];
    if (args.signals.hasCamara || args.signals.hasOnerosidade) {
      refs.push(
        abstract({
          id: 'ref_wp',
          label: 'Nota interna de tese (sem corpo)',
          kind: 'workproduct_ref' as const,
        }),
      );
    }

    return {
      summary: abstract(summaryText),
      decisions,
      tasks,
      refs,
    };
  }
}

function readSignals(
  fields: PresentedField[],
  intent: string | undefined,
): DeclassifySignals {
  const joined = fields.map((f) => f.text.value).join('\n');
  return {
    injection: INJECTION_RE.test(joined) || INJECTION_RE.test(intent ?? ''),
    hasOnerosidade: /onerosidade excessiva/i.test(joined),
    hasCamara: /1a Camara|1ª Câmara/i.test(joined),
  };
}
