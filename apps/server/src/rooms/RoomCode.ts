import { randomInt } from "node:crypto";

// Exclude ambiguous I/O/0/1 glyphs so four-character codes are easy to read and dictate. Every
// character remains uppercase alphanumeric, and 32^4 gives 1,048,576 possible active-room codes.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;
const MAX_CODE_ATTEMPTS = 128;

export function generateRoomCode(existing: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    let code = "";
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error("Could not allocate a unique private room code.");
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidRoomCode(value: string): boolean {
  return (
    value.length === ROOM_CODE_LENGTH &&
    [...value].every((character) => ROOM_CODE_ALPHABET.includes(character))
  );
}
