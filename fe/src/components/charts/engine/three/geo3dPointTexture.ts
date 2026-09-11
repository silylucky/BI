import * as THREE from "three";
import guangquanUrl from "@/assets/geo/platform/guangquan01.png";
import huiguangUrl from "@/assets/geo/platform/huiguang.png";

export type PointEffectTextureSet = {
  baseRing: THREE.Texture;
  glowSheet: THREE.Texture;
};

let cachedTextures: PointEffectTextureSet | null = null;

function loadTexture(url: string, configure?: (tex: THREE.Texture) => void): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  configure?.(texture);
  return texture;
}

export function getPointEffectTextures(): PointEffectTextureSet {
  if (cachedTextures) return cachedTextures;
  cachedTextures = {
    baseRing: loadTexture(guangquanUrl),
    glowSheet: loadTexture(huiguangUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }),
  };
  return cachedTextures;
}

export function resetPointEffectTextureCache(): void {
  if (!cachedTextures) return;
  Object.values(cachedTextures).forEach((tex) => tex.dispose());
  cachedTextures = null;
}
