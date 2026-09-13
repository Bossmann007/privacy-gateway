import { DeterministicBrPii } from "../pii/deterministic-br-pii.js";
import { authorizeRelease } from "../policy/release-policy.js";
import { FlowPolicy } from "../policy/flow-policy.js";
import { ReleasePolicy } from "../policy/release-policy.js";
import { Presenter } from "./presenter.js";
import type {
  CaseRecord,
  ClassificationLevel,
  DeclassifyResult,
  OfficeContext,
  ReleaseId,
  SafeDTO,
} from "../domain/types.js";
import { assertSafeDto } from "../domain/safe-dto.js";

export type DeclassifierDeps = {
  pii: DeterministicBrPii;
  flowPolicy: FlowPolicy;
  releasePolicy: ReleasePolicy;
  presenter: Presenter;
};

const PII_SHAPED =
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{5}-?\d{4}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9\d{4}-?\d{4}\b/i;

/**
 * Egress is declassification, not token redaction.
 * Raw case text never leaves. The presenter builds an abstract SafeDTO;
 * token DLP is an internal stage and never the public contract.
 */
export class Declassifier {
  constructor(private readonly deps: DeclassifierDeps) {}

  declassify(
    rec: CaseRecord,
    ctx: OfficeContext,
    classification: ClassificationLevel,
  ): DeclassifyResult {
    const flow = this.deps.flowPolicy.authorize(ctx, rec, "summarize");
    if (!flow.ok) {
      return {
        ok: false,
        reason: flow.reason,
        denialCode: flow.denialCode,
      };
    }

    const sanitized = this.deps.pii.sanitize({
      rawText: rec.rawText,
      classification,
    });

    const release = authorizeRelease({
      classification,
      taint: rec.taint,
      facts: {
        tribunal: rec.facts.tribunal,
        rito: rec.facts.rito,
        fase: rec.facts.fase,
        pedido: rec.facts.pedido,
        tema: rec.facts.tema,
      },
    });
    if (!release.ok) {
      return {
        ok: false,
        reason: release.reason,
        denialCode: release.denialCode,
      };
    }

    const presented = this.deps.presenter.present({
      rec,
      sanitized,
      classification,
    });
    if (!presented.ok) {
      return {
        ok: false,
        reason: presented.reason,
        denialCode: presented.denialCode,
      };
    }

    const dto: SafeDTO = {
      sessionId: ctx.sessionId,
      releaseId: this.releaseId(),
      classification,
      taint: rec.taint,
      abstract: presented.value.abstract,
      facts: presented.value.facts,
    };

    try {
      assertSafeDto(dto);
    } catch {
      return {
        ok: false,
        reason: "presenter_unsafe",
        denialCode: "PRESENTER_UNSAFE",
      };
    }

    if (this.containsPiiShape(dto)) {
      return {
        ok: false,
        reason: "presenter_unsafe",
        denialCode: "PRESENTER_UNSAFE",
      };
    }

    return { ok: true, value: dto };
  }

  private releaseId(): ReleaseId {
    return `rel_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }

  private containsPiiShape(dto: SafeDTO): boolean {
    const hay = `${dto.abstract} ${JSON.stringify(dto.facts)}`;
    return PII_SHAPED.test(hay);
  }
}
