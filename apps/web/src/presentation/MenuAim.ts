export interface MenuAimLayout {
  readonly menuX: number;
  readonly menuY: number;
  readonly itemSpacing: number;
  readonly itemHeight: number;
  readonly exitIndex: number;
}

export interface MenuAimTarget {
  readonly x: number;
  readonly y: number;
  readonly pointsAtViewer: boolean;
}

export function getMenuAimTarget(index: number, layout: MenuAimLayout): MenuAimTarget {
  return {
    x: layout.menuX - 10,
    y: layout.menuY + index * layout.itemSpacing + layout.itemHeight / 2,
    pointsAtViewer: index === layout.exitIndex,
  };
}
