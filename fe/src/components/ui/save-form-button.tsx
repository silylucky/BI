import { Button, type ButtonProps } from "@/components/ui/button";

export type SaveFormButtonProps = Omit<ButtonProps, "children" | "disabled"> & {
  /** 相对上次成功保存是否有未提交改动 */
  isDirty: boolean;
  saving?: boolean;
  /** 创建页等无基线场景：允许在 isDirty=false 时仍可提交 */
  allowSaveWhenClean?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  disabled?: boolean;
};

/** 编辑页统一保存按钮：无改动时禁用，保存中显示 loading 文案 */
export function SaveFormButton({
  isDirty,
  saving = false,
  allowSaveWhenClean = false,
  saveLabel = "保存",
  savingLabel = "保存中…",
  disabled,
  loading,
  loadingText,
  ...props
}: SaveFormButtonProps) {
  const canSave = allowSaveWhenClean || isDirty;
  const isLoading = saving || Boolean(loading);
  return (
    <Button
      {...props}
      loading={isLoading}
      loadingText={loadingText ?? (isLoading ? savingLabel : undefined)}
      disabled={disabled ?? (!canSave && !isLoading)}
    >
      {saveLabel}
    </Button>
  );
}
