import { describe, it, expect, beforeEach } from 'vitest';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contractRevisions, users } from '../../server/db/schema.js';
import { createDraftingRequest } from '../../server/modules/contracts/service.js';
import { submitDraftRevision } from '../../server/modules/contracts/revisions.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Revisions Immutability & Version Numbering (T22)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let legalActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const legalId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-rev-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: legalId,
        email: `legal-rev-${Date.now()}@dps.media`,
        role: 'legal',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-rev@dps.media',
      role: 'admin',
    };

    legalActor = {
      kind: 'user',
      userId: legalId,
      email: 'legal-rev@dps.media',
      role: 'legal',
    };
  });

  it('keeps historical revisions intact with increasing revision numbers', async () => {
    const createdContract = await createDraftingRequest({
      name: 'Hợp đồng kiểm thử Revision History',
      partnerName: 'Công ty Alpha Beta',
      valueText: '80.000.000 đ',
      legalAssigneeId: legalActor.userId,
      actorId: adminActor.userId,
    });

    const rev1 = await submitDraftRevision({
      contractId: createdContract.id,
      actor: legalActor,
      docsUrl: 'https://docs.google.com/d/first',
    });

    expect(rev1.revisionNumber).toBe(1);

    const allRevs = await db
      .select()
      .from(contractRevisions)
      .where(eq(contractRevisions.contractId, createdContract.id))
      .orderBy(desc(contractRevisions.revisionNumber));

    expect(allRevs).toHaveLength(1);
    expect(allRevs[0].docsUrl).toBe('https://docs.google.com/d/first');
    expect(allRevs[0].submittedBy).toBe(legalActor.userId);
  });
});

