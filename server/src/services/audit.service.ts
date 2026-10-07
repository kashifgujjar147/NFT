import { AuditLog } from '../models/AuditLog.js';
import type { ClientSession } from 'mongoose';

export async function audit(
  args: {
    actorId: any;
    action: string;
    targetType: string;
    targetId: string;
    before?: any;
    after?: any;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  },
  session?: ClientSession | { session: ClientSession },
) {
  const resolvedSession = session && 'session' in session ? session.session : session;
  const docs = await AuditLog.create([args], resolvedSession ? { session: resolvedSession } : undefined);
  return docs[0];
}
