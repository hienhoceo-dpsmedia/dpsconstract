import readline from 'node:readline';
import { bootstrapAdminUser } from '../server/modules/auth/repository.js';

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== KHỞI TẠO TÀI KHOẢN QUẢN TRỊ VIÊN (BOOTSTRAP ADMIN) ===');
  const email = await prompt('Nhập Email quản trị: ');
  const name = await prompt('Nhập Họ và tên: ');
  const password = await prompt('Nhập Mật khẩu (tối thiểu 12 ký tự): ');

  try {
    const admin = await bootstrapAdminUser({ email, name, password });
    console.log(`[SUCCESS] Khởi tạo tài khoản Quản trị viên thành công: ${admin.email} (ID: ${admin.id})`);
    process.exit(0);
  } catch (err) {
    console.error(`[ERROR] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('bootstrap-admin.ts') || process.argv[1]?.endsWith('bootstrap-admin.js')) {
  main();
}

