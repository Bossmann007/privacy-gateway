import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asRawContext,
  type CaseRecord,
  type RawContext,
  type UserPrincipal,
} from '../domain/types.js';
import { RbacStub } from '../rbac/rbac-stub.js';

const here = dirname(fileURLToPath(import.meta.url));

export class CaseFixtureStore {
  private readonly cases: Map<string, CaseRecord>;
  private readonly rbac = new RbacStub();

  constructor(records: CaseRecord[]) {
    this.cases = new Map(records.map((c) => [c.id, c]));
  }

  static fromDefaultFixture(): CaseFixtureStore {
    const path = join(here, '../../fixtures/case-banco-demo.json');
    const raw = JSON.parse(readFileSync(path, 'utf8')) as CaseRecord;
    return new CaseFixtureStore([raw]);
  }

  getAuthorizedSummary(
    user: UserPrincipal,
    caseId: string,
  ): RawContext | null {
    const record = this.cases.get(caseId);
    if (!record) {
      return null;
    }
    if (
      !this.rbac.canAccessCase(user, record.allowedUserIds, record.allowedRoles)
    ) {
      return null;
    }
    for (const doc of record.documents) {
      if (!doc.classification) {
        return null;
      }
    }
    return asRawContext(record.id, record.documents);
  }
}
