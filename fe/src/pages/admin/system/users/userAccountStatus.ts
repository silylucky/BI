export type UserAccountFields = {
  isActive?: boolean;
  lockedUntil?: string | null;
};

export function isUserLocked(lockedUntil: string | null | undefined): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}
