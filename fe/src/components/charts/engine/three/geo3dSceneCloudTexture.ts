import * as THREE from "three";
import cloudTextureUrl from "@/assets/cloud.png";

let sharedCloudTexture: THREE.Texture | null = null;

/** 离线云纹理（对标 sc-datav Demo1 `cloud.png`） */
export function getSceneCloudTexture(): THREE.Texture {
  if (sharedCloudTexture) return sharedCloudTexture;
  const loader = new THREE.TextureLoader();
  const texture = loader.load(cloudTextureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  sharedCloudTexture = texture;
  return texture;
}

/** 按纹理纵横比归一化平面尺寸（最长边 = 1） */
export function resolveSceneCloudPlaneSize(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const w = image?.width ?? 256;
  const h = image?.height ?? 256;
  const max = Math.max(w, h, 1);
  return { width: w / max, height: h / max };
}

/** 测试用：释放缓存纹理 */
export function resetSceneCloudTextureCache(): void {
  sharedCloudTexture?.dispose();
  sharedCloudTexture = null;
}
