import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Hash de senha com scrypt (nativo do Node, sem dependência externa). Parâmetros
// seguem a recomendação da OWASP (N=2^17, r=8, p=1). Tudo que é preciso pra
// conferir a senha fica embutido no próprio hash, então dá pra endurecer os
// parâmetros no futuro sem invalidar as senhas já cadastradas:
//   scrypt$N$r$p$<salt base64>$<hash base64>
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 6;

function deriveKey(password: string, salt: Buffer, n: number, r: number, p: number) {
  const options: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algorithm !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await deriveKey(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash de uma senha aleatória, usado quando o usuário não existe: o login gasta o
// mesmo tempo calculando o scrypt, então não dá pra descobrir pelo tempo de
// resposta quais usuários existem.
let dummyHash: Promise<string> | undefined;
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyHash;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 256) return "A senha pode ter no máximo 256 caracteres.";
  return null;
}
