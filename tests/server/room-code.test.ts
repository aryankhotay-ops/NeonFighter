import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../../apps/server/src/rooms/RoomCode";

describe("private room codes", () => {
  it("generates readable four-character uppercase alphanumeric codes", () => {
    const codes = new Set<string>();
    for (let index = 0; index < 256; index += 1) {
      const code = generateRoomCode(codes);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).toMatch(/^[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[IO01]/);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
  });

  it("normalizes typed codes and validates the exact alphabet and length", () => {
    expect(normalizeRoomCode("  a2b3 ")).toBe("A2B3");
    expect(isValidRoomCode("A2B3")).toBe(true);
    expect(isValidRoomCode("A2B")).toBe(false);
    expect(isValidRoomCode("A2B30")).toBe(false);
    expect(isValidRoomCode("IO01")).toBe(false);
    expect(isValidRoomCode("AB-$")).toBe(false);
  });
});
