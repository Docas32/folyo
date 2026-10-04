export type MenuButtonRect = { top: number; left: number; right: number };
export type MenuSize = {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

/** Viewport dimensions are explicit inputs so positioning stays independent of the DOM.
 * The consumer must constrain an oversized menu to the viewport before measuring it.
 */
export function getMenuPosition(
  buttonRect: MenuButtonRect,
  menuSize: MenuSize,
) {
  const { width, height, viewportWidth, viewportHeight } = menuSize;
  const gap = 8;
  const preferredLeft = buttonRect.right + gap;
  const left =
    preferredLeft + width <= viewportWidth
      ? preferredLeft
      : buttonRect.left - gap - width;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(0, value), Math.max(0, max));
  return {
    top: clamp(buttonRect.top, viewportHeight - height),
    left: clamp(left, viewportWidth - width),
  };
}
