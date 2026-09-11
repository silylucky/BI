/** 圆点纹理 / 正方形网格共用的涟漪环采样 GLSL */
export const RIPPLE_SAMPLE_GLSL = `
bool sampleRippleRing(
  float rDistance,
  float phase,
  float width,
  vec3 baseLight,
  float baseAlpha,
  vec3 rippleColor,
  out vec3 outLight,
  out float outAlpha
) {
  float r = phase * 1.08;
  float w = min(phase * width, width);
  if (rDistance <= r || rDistance >= r + 2.0 * w) {
    return false;
  }
  float per = 0.0;
  if (rDistance < r + w) {
    per = (rDistance - r) / max(w, 0.0001);
    outLight = mix(baseLight, rippleColor, per);
    outAlpha = mix(0.0, baseAlpha, per);
  } else {
    per = (rDistance - r - w) / max(w, 0.0001);
    outLight = mix(rippleColor, baseLight, per);
    outAlpha = mix(baseAlpha, 0.0, per);
  }
  return true;
}`;
