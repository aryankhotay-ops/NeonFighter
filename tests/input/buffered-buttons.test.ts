import { describe, expect, it } from "vitest";
import { InputButton } from "@neon-rivals/simulation";
import { BufferedButtonState } from "../../apps/web/src/input/BufferedButtonState";

describe("local button latching", () => {
  it("preserves a quick tap until the next simulation sample", () => {
    const buffered = new BufferedButtonState();
    buffered.queue(0, InputButton.Light);

    expect(buffered.consume(0, 0)).toBe(InputButton.Light);
    expect(buffered.consume(0, 0)).toBe(0);
  });

  it("combines queued presses with currently held directions", () => {
    const buffered = new BufferedButtonState();
    buffered.queue(1, InputButton.Special);

    expect(buffered.consume(1, InputButton.Left)).toBe(InputButton.Left | InputButton.Special);
  });

  it("keeps both local players independent", () => {
    const buffered = new BufferedButtonState();
    buffered.queue(0, InputButton.Heavy);
    buffered.queue(1, InputButton.Light);

    expect(buffered.consume(0, 0)).toBe(InputButton.Heavy);
    expect(buffered.consume(1, 0)).toBe(InputButton.Light);
  });
});
