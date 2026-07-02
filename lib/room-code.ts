// Base32 excluding ambiguous characters (0/O, 1/I).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a 6-character room code. Caller retries on unique-constraint
 * conflict. Uses the Web Crypto API (available in both the browser and
 * Node 18+) so this module works from client components too.
 */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
