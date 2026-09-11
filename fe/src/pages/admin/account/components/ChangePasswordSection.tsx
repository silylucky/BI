import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  type ChangePasswordFormValues,
  type PasswordFieldName,
  FIELD_LABELS,
  getFirstInvalidField,
  mapChangePasswordApiError,
  validateChangePasswordForm,
  validatePasswordField,
} from "./changePasswordForm";

const EMPTY_FORM: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELD_CONFIG: Array<{
  name: PasswordFieldName;
  id: string;
  autoComplete: string;
  helper?: string;
}> = [
  {
    name: "currentPassword",
    id: "current-password",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    id: "new-password",
    autoComplete: "new-password",
    helper: "密码长度为 8–128 个字符，且不能与当前密码相同。",
  },
  {
    name: "confirmPassword",
    id: "confirm-password",
    autoComplete: "new-password",
    helper: "请再次输入新密码以确认。",
  },
];

const VISIBILITY_LABELS: Record<PasswordFieldName, [hidden: string, visible: string]> = {
  currentPassword: ["显示当前密码", "隐藏当前密码"],
  newPassword: ["显示新密码", "隐藏新密码"],
  confirmPassword: ["显示确认新密码", "隐藏确认新密码"],
};

function buildDescribedBy(helperId: string, errorId: string, hasError: boolean, hasHelper: boolean) {
  return [hasHelper ? helperId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
}

export function ChangePasswordSection() {
  const { logout } = useAuth();
  const [form, setForm] = useState<ChangePasswordFormValues>(EMPTY_FORM);
  const [clientErrors, setClientErrors] = useState<Partial<Record<PasswordFieldName, string>>>({});
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<PasswordFieldName, string>>
  >({});
  const [blockError, setBlockError] = useState<string | null>(null);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const fieldRefs = {
    currentPassword: useRef<HTMLInputElement>(null),
    newPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };

  const focusField = (field: PasswordFieldName) => {
    fieldRefs[field].current?.focus();
  };

  const clearServerError = (field: PasswordFieldName) => {
    setServerFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setBlockError(null);
  };

  const runClientValidation = (options?: { confirmTouched?: boolean }) => {
    const errors = validateChangePasswordForm(form, {
      confirmTouched: options?.confirmTouched ?? confirmTouched,
    });
    setClientErrors(errors);
    return errors;
  };

  const handleFieldChange = (field: PasswordFieldName, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "confirmPassword" && !confirmTouched && value.length > 0) {
        setConfirmTouched(true);
      }
      if (field === "confirmPassword" || field === "newPassword") {
        const nextConfirmTouched = confirmTouched || field === "confirmPassword";
        const confirmError = nextConfirmTouched
          ? validatePasswordField("confirmPassword", next, { confirmTouched: true })
          : null;
        setClientErrors((prevErrors) => {
          const nextErrors = { ...prevErrors };
          if (confirmError) nextErrors.confirmPassword = confirmError;
          else delete nextErrors.confirmPassword;
          if (field === "newPassword") {
            const newError = validatePasswordField("newPassword", next);
            if (newError) nextErrors.newPassword = newError;
            else delete nextErrors.newPassword;
          }
          return nextErrors;
        });
      }
      return next;
    });
    clearServerError(field);
    if (clientErrors[field]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleFieldBlur = (field: PasswordFieldName) => {
    const message = validatePasswordField(field, form, { confirmTouched: true });
    setClientErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async (payload: Pick<ChangePasswordFormValues, "currentPassword" | "newPassword">) => {
      await apiFetch("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword,
        }),
        preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
      });
    },
    onSuccess: () => {
      toast.success("密码已更新，请使用新密码重新登录");
      setForm(EMPTY_FORM);
      setClientErrors({});
      setServerFieldErrors({});
      setBlockError(null);
      setConfirmTouched(false);
      setVisibleFields({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      logout();
    },
    onError: (err: unknown) => {
      const mapped = mapChangePasswordApiError(err);
      if (mapped.isFieldError && mapped.field) {
        setServerFieldErrors({ [mapped.field]: mapped.message });
        setBlockError(null);
        focusField(mapped.field);
        return;
      }
      setBlockError(mapped.message);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBlockError(null);
    setServerFieldErrors({});
    setConfirmTouched(true);

    const errors = runClientValidation({ confirmTouched: true });
    const firstInvalid = getFirstInvalidField(errors);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    mutation.mutate({
      currentPassword: form.currentPassword.trim(),
      newPassword: form.newPassword.trim(),
    });
  };

  const getFieldError = (field: PasswordFieldName) =>
    serverFieldErrors[field] ?? clientErrors[field] ?? null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
        <div>
          <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">修改密码</h2>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            更新当前账号的登录密码。
          </p>

          <form className="mt-4 grid gap-4" onSubmit={handleSubmit} noValidate>
            {FIELD_CONFIG.map(({ name, id, autoComplete, helper }) => {
              const error = getFieldError(name);
              const helperId = `${id}-helper`;
              const errorId = `${id}-error`;
              const describedBy = buildDescribedBy(helperId, errorId, Boolean(error), Boolean(helper));
              const isVisible = visibleFields[name];
              const [hiddenLabel, visibleLabel] = VISIBILITY_LABELS[name];

              return (
                <div key={name} className="space-y-2">
                  <RequiredLabel htmlFor={id}>{FIELD_LABELS[name]}</RequiredLabel>
                  <div className="relative">
                    <Input
                      ref={fieldRefs[name]}
                      id={id}
                      type={isVisible ? "text" : "password"}
                      autoComplete={autoComplete}
                      value={form[name]}
                      onChange={(event) => handleFieldChange(name, event.target.value)}
                      onBlur={() => handleFieldBlur(name)}
                      fieldState={error ? "error" : "default"}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={describedBy}
                      className={cn("pr-11")}
                    />
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1/2 right-1 -translate-y-1/2"
                      aria-label={isVisible ? visibleLabel : hiddenLabel}
                      aria-pressed={isVisible}
                      onClick={() =>
                        setVisibleFields((prev) => ({ ...prev, [name]: !prev[name] }))
                      }
                    >
                      {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </IconButton>
                  </div>
                  {helper ? (
                    <p id={helperId} className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {helper}
                    </p>
                  ) : null}
                  {error ? (
                    <p id={errorId} className="text-theme-xs text-error-600 dark:text-error-400">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {blockError ? (
              <p role="alert" className="text-theme-xs text-error-600 dark:text-error-400">
                {blockError}
              </p>
            ) : null}

            <div>
              <Button
                type="submit"
                loading={mutation.isPending}
                loadingText="保存中…"
                disabled={mutation.isPending}
              >
                更新密码
              </Button>
            </div>
          </form>
        </div>

        <aside className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <h3 className="text-theme-xs font-semibold text-gray-800 dark:text-white/90">密码规则</h3>
          <ul className="mt-2 space-y-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
            <li>长度为 8–128 个字符</li>
            <li>不能与当前密码相同</li>
            <li>确认新密码需与上方新密码一致</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
