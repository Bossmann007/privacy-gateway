import { randomBytes } from 'node:crypto';
import type { Role, UserPrincipal } from '../domain/types.js';

export type OfficeSession = {
  id: string;
  userId: string;
  role: Role;
  caseId: string;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'closed';
};

export class OfficeSessionStore {
  private readonly sessions = new Map<string, OfficeSession>();

  enter(user: UserPrincipal, caseId: string, ttlMs = 60 * 60 * 1000): OfficeSession {
    const id = `ofs_${randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const session: OfficeSession = {
      id,
      userId: user.id,
      role: user.role,
      caseId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      status: 'open',
    };
    this.sessions.set(id, session);
    return session;
  }

  get(sessionId: string): OfficeSession | null {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== 'open') {
      return null;
    }
    if (Date.parse(s.expiresAt) < Date.now()) {
      s.status = 'closed';
      return null;
    }
    return s;
  }

  leave(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) {
      return false;
    }
    s.status = 'closed';
    return true;
  }
}
