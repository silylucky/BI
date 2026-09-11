import * as THREE from "three";
import gaoguangUrl from "@/assets/geo/platform/gaoguang1.png";
import gridUrl from "@/assets/geo/platform/grid.png";
import gridBlackUrl from "@/assets/geo/platform/gridBlack.png";
import rotationBorder1Url from "@/assets/geo/platform/rotationBorder1.png";
import rotationBorder2Url from "@/assets/geo/platform/rotationBorder2.png";

export type PlatformTextureSet = {
  highlight: THREE.Texture;
  grid: THREE.Texture;
  gridBlack: THREE.Texture;
  rotationBorder1: THREE.Texture;
  rotationBorder2: THREE.Texture;
};

let cachedTextures: PlatformTextureSet | null = null;

function loadTexture(url: string, configure?: (tex: THREE.Texture) => void): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(url);
  configure?.(texture);
  return texture;
}

export function getPlatformTextures(): PlatformTextureSet {
  if (cachedTextures) return cachedTextures;
  const highlight = loadTexture(gaoguangUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  });
  const grid = loadTexture(gridUrl, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 80);
  });
  const gridBlack = loadTexture(gridBlackUrl, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 80);
  });
  cachedTextures = {
    highlight,
    grid,
    gridBlack,
    rotationBorder1: loadTexture(rotationBorder1Url),
    rotationBorder2: loadTexture(rotationBorder2Url),
  };
  return cachedTextures;
}

export function resetPlatformTextureCache(): void {
  if (!cachedTextures) return;
  Object.values(cachedTextures).forEach((tex) => tex.dispose());
  cachedTextures = null;
}
