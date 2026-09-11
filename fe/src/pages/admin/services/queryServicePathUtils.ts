export type ServicePathMeta = {
  basePath: string;
  requiredParams: string[];
};

/** Aligns with backend `_parse_required_params` (`;requires=a,b` segment). */
export function parseServicePathMeta(path: string): ServicePathMeta {
  const basePath = path.split(";")[0] ?? path;
  const requiredParams: string[] = [];

  if (!path.includes(";requires=")) {
    return { basePath, requiredParams };
  }

  const [, fragment] = path.split(";requires=", 2);
  const requiresPart = (fragment ?? "").split(";")[0] ?? "";
  for (const part of requiresPart.split(",")) {
    const trimmed = part.trim();
    if (trimmed) requiredParams.push(trimmed);
  }

  return { basePath, requiredParams };
}

export function buildExecuteParameters(
  requiredParams: string[],
  values: Record<string, string>,
): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const name of requiredParams) {
    parameters[name] = values[name] ?? "";
  }
  return parameters;
}
