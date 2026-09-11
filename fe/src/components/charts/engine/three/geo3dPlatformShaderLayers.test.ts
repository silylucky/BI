import { describe, expect, it } from "vitest";
import {
  createPlatformGlowMesh,
  createPlatformGridUniforms,
  createPlatformShaderUniforms,
  createPlatformSquareGridMesh,
  tickPlatformShaderUniforms,
} from "./geo3dPlatformShaderLayers";
import {
  createPlatformSquareRippleMesh,
  createPlatformSquareRippleUniforms,
} from "./geo3dPlatformSquareRippleMaterial";

describe("geo3dPlatformShaderLayers", () => {
  it("creates glow mesh with shader material", () => {
    const uniforms = createPlatformShaderUniforms("#22d3ee", 0.5);
    const mesh = createPlatformGlowMesh(10, uniforms);
    expect(mesh.material.type).toBe("ShaderMaterial");
    expect(mesh.material.transparent).toBe(true);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it("advances shader time on tick", () => {
    const uniforms = createPlatformShaderUniforms("#a78bfa", 0.4);
    tickPlatformShaderUniforms(uniforms, 0.5);
    expect(uniforms.uTime.value).toBe(0.5);
  });

  it("creates square grid mesh", () => {
    const uniforms = createPlatformGridUniforms("#38bdf8", 0.2, 120);
    const mesh = createPlatformSquareGridMesh(12, uniforms);
    expect(mesh.material.type).toBe("ShaderMaterial");
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});

describe("geo3dPlatformSquareRippleMaterial", () => {
  it("creates masked square ripple overlay mesh", () => {
    const uniforms = createPlatformSquareRippleUniforms(
      "#38bdf8",
      "#0ea5e9",
      0.5,
      120,
      1,
      2,
    );
    const mesh = createPlatformSquareRippleMesh(12, uniforms);
    expect(mesh.material.type).toBe("ShaderMaterial");
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
