const FIELD_IDS = {
  currentPassword: "current-password",
  newPassword: "new-password",
  confirmPassword: "confirm-password",
} as const;

export type PasswordInputName = keyof typeof FIELD_IDS;

/** Stable password input lookup; avoids label/aria-label collisions from visibility toggles. */
export function getPasswordInput(name: PasswordInputName) {
  const input = document.getElementById(FIELD_IDS[name]);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected password input #${FIELD_IDS[name]}`);
  }
  return input;
}
