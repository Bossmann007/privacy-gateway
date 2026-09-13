import type { Role, UserPrincipal } from '../domain/types.js';

const ROLE_RANK: Record<Role, number> = {
  estagiario: 1,
  advogado: 2,
  socio: 3,
};

export class RbacStub {
  canAccessCase(
    user: UserPrincipal,
    allowedUserIds: string[],
    allowedRoles: Role[],
  ): boolean {
    if (!user.role || !(user.role in ROLE_RANK)) {
      return false;
    }
    if (!allowedRoles.includes(user.role)) {
      return false;
    }
    if (user.role === 'socio') {
      return true;
    }
    return allowedUserIds.includes(user.id);
  }

  minRank(role: Role): number {
    return ROLE_RANK[role];
  }
}
