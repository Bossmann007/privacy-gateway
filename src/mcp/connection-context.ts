import type { Role, UserPrincipal } from '../domain/types.js';

export type ConnectionContext = {
  readonly principal: UserPrincipal;
};

export const PRINCIPAL_ARGUMENT_KEYS = [
  'user',
  'userId',
  'role',
  'principal',
] as const;

export const PRINCIPAL_IN_ARGUMENTS = 'PRINCIPAL_IN_ARGUMENTS';
export const CONNECTION_PRINCIPAL_MISSING = 'CONNECTION_PRINCIPAL_MISSING';

const ROLES: readonly Role[] = ['socio', 'advogado', 'estagiario'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function argumentsCarryPrincipal(
  args: Record<string, unknown>,
): boolean {
  return PRINCIPAL_ARGUMENT_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(args, key),
  );
}

export function parseConnectionFromEnv(
  env: NodeJS.Dict<string> = process.env,
): ConnectionContext {
  const id = env.OFFICE_USER_ID;
  const role = env.OFFICE_ROLE;
  if (!id || !isRole(role)) {
    throw new Error(CONNECTION_PRINCIPAL_MISSING);
  }
  return { principal: { id, role } };
}
