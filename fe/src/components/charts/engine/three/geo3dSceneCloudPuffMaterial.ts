import * as THREE from "three";
import { getSceneCloudTexture } from "@/components/charts/engine/three/geo3dSceneCloudTexture";

export type CloudPuffMaterialOptions = {
  opacity: number;
  color?: THREE.ColorRepresentation;
};

const OPAQUE_FRAGMENT =
  parseInt(THREE.REVISION.replace(/\D+/g, ""), 10) >= 154 ? "opaque_fragment" : "output_fragment";

/**
 * 远景云贴片：纹理自带明暗，使用不受光照影响的 Basic 材质，
 * 避免 billboard 法线随相机变化导致 Lambert 着色发灰/发黄。
 */
export function createCloudPuffMaterial(options: CloudPuffMaterialOptions): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    map: getSceneCloudTexture(),
    color: options.color ?? 0xffffff,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `attribute float cloudOpacity;
varying float vCloudOpacity;
` + shader.vertexShader.replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
vCloudOpacity = cloudOpacity;
`,
      );

    shader.fragmentShader =
      `varying float vCloudOpacity;
` + shader.fragmentShader.replace(
        `#include <${OPAQUE_FRAGMENT}>`,
        `#include <${OPAQUE_FRAGMENT}>
gl_FragColor = vec4(diffuseColor.rgb, diffuseColor.a * vCloudOpacity);
`,
      );
  };

  material.customProgramCacheKey = () => "geo3d-scene-cloud-puff-basic";
  return material;
}
