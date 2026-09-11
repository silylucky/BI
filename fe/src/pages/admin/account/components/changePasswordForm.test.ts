import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/api";
import {
  getFirstInvalidField,
  mapChangePasswordApiError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateChangePasswordForm,
  validatePasswordField,
} from "./changePasswordForm";

const emptyValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

describe("changePasswordForm validation", () => {
  it("requires all fields", () => {
    expect(validatePasswordField("currentPassword", emptyValues)).toBe("请填写当前密码");
    expect(validatePasswordField("newPassword", emptyValues)).toBe("请填写新密码");
    expect(validatePasswordField("confirmPassword", emptyValues)).toBe("请填写确认新密码");
  });

  it("enforces new password length boundaries", () => {
    const short = {
      ...emptyValues,
      currentPassword: "old-pass-1",
      newPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1),
      confirmPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    };
    const long = {
      ...emptyValues,
      currentPassword: "old-pass-1",
      newPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1),
      confirmPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1),
    };

    expect(validatePasswordField("newPassword", short)).toBe("新密码至少需要 8 个字符");
    expect(validatePasswordField("newPassword", long)).toBe("新密码不能超过 128 个字符");
  });

  it("rejects unchanged password and confirm mismatch", () => {
    const samePassword = {
      currentPassword: "same-pass-1",
      newPassword: "same-pass-1",
      confirmPassword: "same-pass-1",
    };
    const mismatch = {
      currentPassword: "old-pass-1",
      newPassword: "new-pass-12",
      confirmPassword: "new-pass-13",
    };

    expect(validatePasswordField("newPassword", samePassword)).toBe("新密码不能与当前密码相同");
    expect(
      validatePasswordField("confirmPassword", mismatch, { confirmTouched: true }),
    ).toBe("两次输入的新密码不一致");
    expect(
      validatePasswordField("confirmPassword", mismatch, { confirmTouched: false }),
    ).toBeNull();
  });

  it("returns the first invalid field in stable order", () => {
    const errors = validateChangePasswordForm(emptyValues, { confirmTouched: true });
    expect(getFirstInvalidField(errors)).toBe("currentPassword");
  });
});

describe("changePasswordForm server error mapping", () => {
  it("maps current password and unchanged password codes to fields", () => {
    expect(
      mapChangePasswordApiError(
        new ApiRequestError("当前密码不正确", "AUTH_INVALID_CURRENT_PASSWORD"),
      ),
    ).toEqual({
      field: "currentPassword",
      message: "当前密码不正确",
      isFieldError: true,
    });

    expect(
      mapChangePasswordApiError(
        new ApiRequestError("新密码不能与当前密码相同", "AUTH_PASSWORD_UNCHANGED"),
      ),
    ).toEqual({
      field: "newPassword",
      message: "新密码不能与当前密码相同",
      isFieldError: true,
    });
  });

  it("keeps unknown errors at block level", () => {
    expect(
      mapChangePasswordApiError(new ApiRequestError("服务繁忙", "SERVER_BUSY")),
    ).toEqual({
      message: "服务繁忙",
      isFieldError: false,
    });
  });
});
