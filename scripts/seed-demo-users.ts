import { getDb } from '../server/db/client.js';
import { users } from '../server/db/schema.js';
import { hashPassword } from '../server/modules/auth/passwords.js';
import { eq } from 'drizzle-orm';

async function seed() {
  const db = getDb();

  const demoAccounts = [
    {
      id: 'demo_admin_01',
      email: 'admin@dps.media',
      name: 'Quản Trị Viên (Admin)',
      role: 'admin' as const,
      plainPass: 'Admin@123456!',
    },
    {
      id: 'demo_legal_01',
      email: 'legal@dps.media',
      name: 'Nguyễn Văn Pháp Chế (Legal)',
      role: 'legal' as const,
      plainPass: 'Legal@123456!',
    },
    {
      id: 'demo_clerk_01',
      email: 'clerk@dps.media',
      name: 'Trần Thị Văn Thư (Clerk)',
      role: 'clerk' as const,
      plainPass: 'Clerk@123456!',
    },
  ];

  for (const acc of demoAccounts) {
    const passwordHash = await hashPassword(acc.plainPass);

    await db
      .insert(users)
      .values({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        role: acc.role,
        passwordHash,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          status: 'active',
          role: acc.role,
          name: acc.name,
        },
      });

    console.log(`[SEED] Thiết lập tài khoản: ${acc.email} | Vai trò: ${acc.role} | Mật khẩu: ${acc.plainPass}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('[SEED_ERROR]', err);
  process.exit(1);
});

