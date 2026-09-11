const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

/** 生成符合后端最小长度（8）的临时密码 */
export function generateTemporaryPassword(length = 12): string {
  const size = Math.max(8, length);
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export const MIN_INITIAL_PASSWORD_LENGTH = 8;
