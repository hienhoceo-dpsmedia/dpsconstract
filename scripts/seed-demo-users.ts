import { getDb } from '../server/db/client.js';
import { users } from '../server/db/schema.js';
import { hashPassword } from '../server/modules/auth/passwords.js';
import { eq } from 'drizzle-orm';

async function seedDemoUsers() {
  const db = getDb();
  const password = 'AdminPassword123!';
  const passwordHash = await hashPassword(password);

  const demoAccounts = [
    { email: 'admin@dps.media', name: 'Giám Đốc Quản Trị', role: 'admin' as const },
    { email: 'legal@dps.media', name: 'Chuyên Viên Pháp Chế', role: 'legal' as const },
    { email: 'clerk@dps.media', name: 'Cán Bộ Văn Thư', role: 'clerk' as const },
  ];

  for (const acc of demoAccounts) {
    const [existing] = await db.select().from(users).where(eq(users.email, acc.email));
    if (existing) {
      await db.update(users).set({
        name: acc.name,
        role: acc.role,
        passwordHash,
        status: 'active',
      }).where(eq(users.id, existing.id));
      console.log(`[UPDATED] User ${acc.email} (${acc.role}) with password: ${password}`);
    } else {
      const id = `usr_${acc.role}_demo_${Date.now()}`;
      await db.insert(users).values({
        id,
        email: acc.email,
        name: acc.name,
        role: acc.role,
        passwordHash,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[INSERTED] User ${acc.email} (${acc.role}) with password: ${password}`);
    }
  }

  process.exit(0);
}

seedDemoUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
