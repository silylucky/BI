import { Input } from "@/components/ui/input";
import {
  CONNECTOR_FIELD_HINTS,
  connectorHintId,
  hidePortField,
  hostFieldLabel,
  type FormState,
} from "./datasource-form-constants";
import { CONNECTION_CONTROL_CLASS, ConnectionFormField } from "./ConnectionFormField";

type Props = {
  form: FormState;
  mode: "create" | "edit";
  onFieldChange: (key: keyof FormState, value: string) => void;
};

export function GenericConnectionFields({ form, mode, onFieldChange }: Props) {
  const hintId = connectorHintId(form.type);
  const databaseLabel = CONNECTOR_FIELD_HINTS[form.type]?.databaseLabel ?? "数据库";
  const usernameLabel = CONNECTOR_FIELD_HINTS[form.type]?.usernameLabel ?? "用户名";

  return (
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
      <ConnectionFormField label={hostFieldLabel(form.type)} htmlFor="host">
        <Input
          id="host"
          className={CONNECTION_CONTROL_CLASS}
          value={form.host}
          onChange={(e) => onFieldChange("host", e.target.value)}
          required
        />
      </ConnectionFormField>
      {hidePortField(form.type) ? null : (
        <ConnectionFormField label="端口" htmlFor="port">
          <Input
            id="port"
            type="number"
            className={CONNECTION_CONTROL_CLASS}
            value={form.port}
            onChange={(e) => onFieldChange("port", e.target.value)}
            required
          />
        </ConnectionFormField>
      )}
      <ConnectionFormField
        label={databaseLabel}
        htmlFor="database"
        className={hidePortField(form.type) ? "sm:col-span-2" : undefined}
      >
        <Input
          id="database"
          className={CONNECTION_CONTROL_CLASS}
          value={form.database}
          onChange={(e) => onFieldChange("database", e.target.value)}
          required
          aria-describedby={hintId}
        />
      </ConnectionFormField>
      <ConnectionFormField label={usernameLabel} htmlFor="username">
        <Input
          id="username"
          className={CONNECTION_CONTROL_CLASS}
          value={form.username}
          onChange={(e) => onFieldChange("username", e.target.value)}
          required
        />
      </ConnectionFormField>
      <ConnectionFormField
        label={mode === "edit" ? "密码（留空不修改）" : "密码"}
        htmlFor="password"
        hint={mode === "edit" ? "留空表示继续使用已保存的凭证。" : undefined}
      >
        <Input
          id="password"
          type="password"
          className={CONNECTION_CONTROL_CLASS}
          value={form.password}
          onChange={(e) => onFieldChange("password", e.target.value)}
          required={mode === "create"}
          autoComplete={mode === "create" ? "new-password" : "current-password"}
        />
      </ConnectionFormField>
    </div>
  );
}
