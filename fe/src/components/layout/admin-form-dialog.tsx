import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogContent,
} from "@/components/ui/dialog";
import { guardDialogDismiss } from "@/lib/dialogNestedDismissGuard";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AdminFormDialogPortalContext = React.createContext<HTMLElement | null>(null);

/** Dialog 内 Select 下拉挂载容器（由 AdminFormDialogContent / DialogSelectPortalProvider 注入） */
export function useAdminFormDialogPortalContainer(): HTMLElement | undefined {
  return React.useContext(AdminFormDialogPortalContext) ?? undefined;
}

/** 任意 Dialog 内容区可包裹，使内部 Select 挂载在弹层内，避免误关弹窗 */
export function DialogSelectPortalProvider({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  return (
    <AdminFormDialogPortalContext.Provider value={portalContainer}>
      <div
        ref={setPortalContainer}
        data-dialog-select-portal=""
        className={cn("relative flex min-h-0 flex-col", className)}
      >
        {children}
      </div>
    </AdminFormDialogPortalContext.Provider>
  );
}

type AdminFormDialogSize = "sm" | "md" | "lg";

const sizeClass: Record<AdminFormDialogSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl",
};

type AdminFormDialogContentProps = React.ComponentPropsWithoutRef<typeof DialogContent> & {
  size?: AdminFormDialogSize;
  /** 内容区可滚动（长表单 / Tabs） */
  scrollable?: boolean;
};

function AdminFormDialogContent({
  size = "sm",
  scrollable = false,
  className,
  children,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  ...props
}: AdminFormDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        "gap-0 overflow-hidden p-0",
        scrollable && "flex max-h-[min(90dvh,720px)] flex-col",
        sizeClass[size],
        className,
      )}
      onPointerDownOutside={(event) => {
        guardDialogDismiss(event);
        onPointerDownOutside?.(event);
      }}
      onInteractOutside={(event) => {
        guardDialogDismiss(event);
        onInteractOutside?.(event);
      }}
      onFocusOutside={(event) => {
        guardDialogDismiss(event);
        onFocusOutside?.(event);
      }}
      {...props}
    >
      <DialogSelectPortalProvider
        className={cn("flex min-h-0 flex-col", scrollable && "min-h-0 flex-1 overflow-hidden")}
      >
        {children}
      </DialogSelectPortalProvider>
    </DialogContent>
  );
}

function AdminFormDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <DialogHeader
      className={cn(
        "shrink-0 gap-1 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]",
        className,
      )}
      {...props}
    />
  );
}

function AdminFormDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  return (
    <DialogDescription
      className={cn("text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400", className)}
      {...props}
    />
  );
}

type AdminFormDialogBodyProps = React.ComponentProps<"div"> & {
  scrollable?: boolean;
};

function AdminFormDialogBody({ scrollable = false, className, ...props }: AdminFormDialogBodyProps) {
  return (
    <div
      className={cn(
        "grid gap-3.5 px-5 py-4",
        scrollable && "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
}

function AdminFormDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn("shrink-0 px-5 py-3.5", className)} {...props} />;
}

type AdminFormFieldProps = {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

function AdminFormField({ label, htmlFor, hint, error, className, children }: AdminFormFieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">{error}</p>
      ) : null}
    </div>
  );
}

type AdminFormCheckboxOptionProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

function AdminFormCheckboxOption({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: AdminFormCheckboxOptionProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors",
        "hover:border-brand-200 hover:bg-brand-50/40",
        checked && "border-brand-200 bg-brand-50/50",
        "dark:border-gray-800 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5",
        checked && "dark:border-brand-500/40 dark:bg-brand-500/10",
        disabled && "cursor-not-allowed opacity-60 hover:border-gray-200 hover:bg-transparent dark:hover:border-gray-800 dark:hover:bg-transparent",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="text-theme-sm text-gray-800 dark:text-white/90">{label}</span>
    </label>
  );
}

export {
  AdminFormDialogContent,
  AdminFormDialogHeader,
  AdminFormDialogDescription,
  AdminFormDialogBody,
  AdminFormDialogFooter,
  AdminFormField,
  AdminFormCheckboxOption,
};
