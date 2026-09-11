import { ApiRequestError } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";

export type PasswordFieldName = "currentPassword" | "newPassword" | "confirmPassword";

export type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const FIELD_LABELS: Record<PasswordFieldName, string> = {
  currentPassword: "当前密码",
  newPassword: "新密码",
  confirmPassword: "确认新密码",
};

const FIELD_ORDER: PasswordFieldName[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

export function validatePasswordField(
  field: PasswordFieldName,
  values: ChangePasswordFormValues,
  options?: { confirmTouched?: boolean },
): string | null {
  const value = values[field].trim();

  if (!value) {
    return `请填写${FIELD_LABELS[field]}`;
  }

  if (field === "newPassword") {
    if (value.length < PASSWORD_MIN_LENGTH) {
      return "新密码至少需要 8 个字符";
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
      return "新密码不能超过 128 个字符";
    }
    if (values.currentPassword.trim() && value === values.currentPassword.trim()) {
      return "新密码不能与当前密码相同";
    }
  }

  if (field === "confirmPassword" && options?.confirmTouched) {
    if (value !== values.newPassword.trim()) {
      return "两次输入的新密码不一致";
    }
  }

  return null;
}

export function validateChangePasswordForm(
  values: ChangePasswordFormValues,
  options?: { confirmTouched?: boolean },
): Partial<Record<PasswordFieldName, string>> {
  const errors: Partial<Record<PasswordFieldName, string>> = {};

  for (const field of FIELD_ORDER) {
    const message = validatePasswordField(field, values, options);
    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

export function getFirstInvalidField(
  errors: Partial<Record<PasswordFieldName, string>>,
): PasswordFieldName | null {
  return FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null;
}

export function mapChangePasswordApiError(err: unknown): {
  field?: PasswordFieldName;
  message: string;
  isFieldError: boolean;
} {
  if (err instanceof ApiRequestError) {
    if (err.code === "AUTH_INVALID_CURRENT_PASSWORD") {
      return {
        field: "currentPassword",
        message: mapApiError(err),
        isFieldError: true,
      };
    }
    if (err.code === "AUTH_PASSWORD_UNCHANGED") {
      return {
        field: "newPassword",
        message: mapApiError(err),
        isFieldError: true,
      };
    }
  }

  return {
    message: mapApiError(err),
    isFieldError: false,
  };
}
