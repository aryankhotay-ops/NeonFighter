import { describe, expect, it } from "vitest";
import { getMenuAimTarget, type MenuAimLayout } from "../../apps/web/src/presentation/MenuAim";

const layout: MenuAimLayout = {
  menuX: 706,
  menuY: 178,
  itemSpacing: 64,
  itemHeight: 56,
  exitIndex: 6,
};

describe("main menu laser targeting", () => {
  it("targets the vertical center of each ordinary menu option", () => {
    expect(getMenuAimTarget(0, layout)).toEqual({ x: 696, y: 206, pointsAtViewer: false });
    expect(getMenuAimTarget(4, layout)).toEqual({ x: 696, y: 462, pointsAtViewer: false });
  });

  it("switches to the viewer-facing pose only for Exit Game", () => {
    expect(getMenuAimTarget(5, layout).pointsAtViewer).toBe(false);
    expect(getMenuAimTarget(6, layout)).toEqual({ x: 696, y: 590, pointsAtViewer: true });
  });
});
