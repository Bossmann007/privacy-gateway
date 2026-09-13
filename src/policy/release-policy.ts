import type { Role } from '../domain/types.js';
import type { SafeDTO } from '../domain/safe-dto.js';
import { LIST_MAX } from '../domain/safe-dto.js';

export type ReleaseProfile = {
  maxDecisions: number;
  maxTasks: number;
  maxRefs: number;
  includeWorkproductRefs: boolean;
  summaryStyle: 'rich' | 'standard' | 'minimal';
};

const PROFILES: Record<Role, ReleaseProfile> = {
  socio: {
    maxDecisions: LIST_MAX,
    maxTasks: LIST_MAX,
    maxRefs: LIST_MAX,
    includeWorkproductRefs: true,
    summaryStyle: 'rich',
  },
  advogado: {
    maxDecisions: 3,
    maxTasks: 3,
    maxRefs: 3,
    includeWorkproductRefs: true,
    summaryStyle: 'standard',
  },
  estagiario: {
    maxDecisions: 1,
    maxTasks: 2,
    maxRefs: 1,
    includeWorkproductRefs: false,
    summaryStyle: 'minimal',
  },
};

export class ReleasePolicy {
  profileFor(role: Role): ReleaseProfile {
    return PROFILES[role];
  }

  /** Never returns raw. Only thins an already-declassified SafeDTO. */
  apply(role: Role, dto: SafeDTO): SafeDTO {
    const p = this.profileFor(role);
    const refs = dto.safeReferences
      .filter((r) => p.includeWorkproductRefs || r.kind !== 'workproduct_ref')
      .slice(0, p.maxRefs);
    return {
      ...dto,
      decisions: dto.decisions.slice(0, p.maxDecisions),
      tasks: dto.tasks.slice(0, p.maxTasks),
      safeReferences: refs,
      warnings:
        p.summaryStyle === 'minimal'
          ? [
              ...dto.warnings,
              {
                code: 'release_limited',
                message: 'Release capped for intern role. Raw context never included.',
              },
            ]
          : dto.warnings,
    };
  }
}
