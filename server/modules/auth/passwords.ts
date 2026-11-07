import argon2 from 'argon2';

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 12 || plain.length > 128) {
    throw new Error('Mật khẩu phải có độ dài từ 12 đến 128 ký tự.');
  }

  return await argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

