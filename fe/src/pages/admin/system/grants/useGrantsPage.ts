import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useListPagination } from "@/lib/list-pagination";
import { queryKeys } from "@/lib/queryKeys";
import { mapGrantError } from "./grantErrors";
import {
  EMPTY_GRANT_CREATE,
  grantCreateSchema,
  type GrantCreateValues,
  type ResourceType,
} from "./grantFormSchema";

export type RoleOut = { id: string; code: string; name: string };

export type ResourceGrantOut = {
  id: string;
  roleId: string;
  resourceType: ResourceType;
  resourceId: string;
};

type GrantApiRow = {
  id: string;
  role_id?: string;
  roleId?: string;
  resource_type?: string;
  resourceType?: string;
  resource_id?: string;
  resourceId?: string;
};

function normalizeGrant(row: GrantApiRow): ResourceGrantOut {
  return {
    id: row.id,
    roleId: row.roleId ?? row.role_id ?? "",
    resourceType: (row.resourceType ?? row.resource_type ?? "datasource") as ResourceType,
    resourceId: row.resourceId ?? row.resource_id ?? "",
  };
}

export function useGrantsPage(
  resolveResourceName?: (type: ResourceType, id: string) => string | undefined,
) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResourceGrantOut | null>(null);
  const [form, setForm] = useState<GrantCreateValues>(EMPTY_GRANT_CREATE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const grantsQuery = useQuery({
    queryKey: queryKeys.resourceGrants.list(),
    queryFn: async () => {
      const res = await apiFetch<{ items: GrantApiRow[] }>("/api/v1/resource-grants");
      return { items: res.items.map(normalizeGrant) };
    },
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list({ limit: 200, offset: 0 }),
    queryFn: () => apiFetch<{ items: RoleOut[] }>("/api/v1/roles?limit=200&offset=0"),
  });

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rolesQuery.data?.items ?? []) map.set(r.id, r.name);
    return map;
  }, [rolesQuery.data?.items]);

  const filteredItems = useMemo(() => {
    const items = grantsQuery.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (roleFilter !== "all" && row.roleId !== roleFilter) return false;
      if (typeFilter !== "all" && row.resourceType !== typeFilter) return false;
      if (q) {
        const name = resolveResourceName?.(row.resourceType, row.resourceId)?.toLowerCase() ?? "";
        if (!row.resourceId.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [grantsQuery.data?.items, resolveResourceName, roleFilter, search, typeFilter]);

  const pagination = useListPagination(undefined, [search, roleFilter, typeFilter]);

  const paginatedItems = useMemo(() => {
    const start = pagination.offset;
    return filteredItems.slice(start, start + pagination.pageSize);
  }, [filteredItems, pagination.offset, pagination.pageSize]);

  const createMutation = useMutation({
    mutationFn: (body: GrantCreateValues) =>
      apiFetch<ResourceGrantOut>("/api/v1/resource-grants", {
        method: "POST",
        body: JSON.stringify({
          role_id: body.roleId,
          resource_type: body.resourceType,
          resource_id: body.resourceId,
        }),
      }),
    onSuccess: () => {
      toast.success("授权创建成功");
      setDialogOpen(false);
      setForm(EMPTY_GRANT_CREATE);
      setFormErrors({});
      void queryClient.invalidateQueries({ queryKey: queryKeys.resourceGrants.all });
    },
    onError: (err) => setActionError(mapGrantError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (grantId: string) =>
      apiFetch<void>(`/api/v1/resource-grants/${grantId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("授权已撤销");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resourceGrants.all });
    },
    onError: (err) => setActionError(mapGrantError(err)),
  });

  const submitCreate = () => {
    setActionError(null);
    const parsed = grantCreateSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[String(issue.path[0] ?? "form")] = issue.message;
      }
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    createMutation.mutate(parsed.data);
  };

  const openCreate = () => {
    setForm(EMPTY_GRANT_CREATE);
    setFormErrors({});
    setActionError(null);
    setDialogOpen(true);
  };

  return {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    typeFilter,
    setTypeFilter,
    dialogOpen,
    setDialogOpen,
    deleteTarget,
    setDeleteTarget,
    form,
    setForm,
    formErrors,
    actionError,
    setActionError,
    grantsQuery,
    rolesQuery,
    roleNameById,
    filteredItems,
    paginatedItems,
    pagination,
    createMutation,
    deleteMutation,
    submitCreate,
    openCreate,
  };
}
