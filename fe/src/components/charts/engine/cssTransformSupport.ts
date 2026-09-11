/** 看板/大屏 canvas 存在 CSS transform scale 时必须开启，否则 tooltip/点击坐标偏移 */
export const CANVAS_CSS_TRANSFORM_SUPPORT = {
  supportCSSTransform: true,
} as const;

export function withCanvasCssTransformSupport<T extends Record<string, unknown>>(
  options: T,
): T & { supportCSSTransform: true } {
  return { ...options, supportCSSTransform: true };
}
