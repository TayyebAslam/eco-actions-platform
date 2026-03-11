"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { permissionsApi } from "@/lib/api";
import { ModulePermission } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PermissionsFormProps {
  userId: number;
  onSaved?: () => void;
  targetUserRole?: string;
  scope?: "school" | "all";
}

export function PermissionsForm({ userId, onSaved, targetUserRole, scope = "school" }: PermissionsFormProps) {
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [permissionError, setPermissionError] = useState("");
  const queryClient = useQueryClient();
  const { canEditPermissionsFor } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      const response = await permissionsApi.getUserPermissions(userId);
      return response.data.data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (data?.permissions) {
      const rawPermissions: ModulePermission[] = Array.isArray(data.permissions)
        ? (data.permissions as ModulePermission[])
        : [];
      const filtered: ModulePermission[] = scope === "all"
        ? rawPermissions
        : rawPermissions.filter((p) => p.scope === scope);
      const deduped: ModulePermission[] = Array.from(
        filtered.reduce<Map<string, ModulePermission>>((map, permission) => {
          const normalizedKey = permission.key?.trim().toLowerCase();
          const normalizedName = permission.name?.trim().toLowerCase();
          const dedupeKey = normalizedKey || normalizedName || `module-${permission.module_id}`;
          // Keep the latest row when duplicates exist so API ordering determines final state.
          map.set(dedupeKey, permission);
          return map;
        }, new Map<string, ModulePermission>()).values()
      );
      setPermissions(deduped);
    }
  }, [data, scope]);

  const mutation = useMutation({
    mutationFn: () => {
      const permissionData = permissions.map((p) => ({
        module_id: p.module_id,
        can_create: p.can_create,
        can_read: p.can_read,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));
      return permissionsApi.updateUserPermissions(userId, permissionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] });
      toast.success("Permissions updated successfully");
      onSaved?.();
    },
    onError: () => {
      toast.error("Failed to update permissions");
    },
  });

  const handleToggle = (
    moduleId: number,
    field: "can_create" | "can_read" | "can_edit" | "can_delete"
  ) => {
    if (permissionError) {
      setPermissionError("");
    }
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.module_id === moduleId) {
          const newValue = !p[field];
          
          // If enabling create or edit, also enable read
          if ((field === "can_create" || field === "can_edit") && newValue) {
            return { ...p, [field]: newValue, can_read: true };
          }
          
          // If disabling read, also disable create and edit
          if (field === "can_read" && !newValue) {
            return { ...p, [field]: newValue, can_create: false, can_edit: false };
          }
          
          return { ...p, [field]: newValue };
        }
        return p;
      })
    );
  };

  const handleSelectAll = (moduleId: number, checked: boolean) => {
    if (permissionError) {
      setPermissionError("");
    }
    setPermissions((prev) =>
      prev.map((p) =>
        p.module_id === moduleId
          ? {
            ...p,
            can_create: checked,
            can_read: checked,
            can_edit: checked,
            can_delete: checked,
          }
          : p
      )
    );
  };

  const handleSelectAllModules = (checked: boolean) => {
    if (permissionError) {
      setPermissionError("");
    }
    setPermissions((prev) =>
      prev.map((p) => ({
        ...p,
        can_create: checked,
        can_read: checked,
        can_edit: checked,
        can_delete: checked,
      }))
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const allSelected = permissions.every(
    (p) => p.can_create && p.can_read && p.can_edit && p.can_delete
  );

  const handleSavePermissions = () => {
    const hasAnyPermission = permissions.some(
      (p) => p.can_create || p.can_read || p.can_edit || p.can_delete
    );

    if (!hasAnyPermission) {
      setPermissionError("Please assign at least one permission");
      return;
    }

    setPermissionError("");
    mutation.mutate();
  };

  // Check if current user has permission to edit this user's permissions
  const hasEditPermission = targetUserRole ? canEditPermissionsFor(targetUserRole) : true;

  return (
    <div className="space-y-4">
      {/* Select All Button */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all-permissions"
            checked={allSelected}
            onCheckedChange={(checked) => handleSelectAllModules(!!checked)}
            disabled={!hasEditPermission}
          />
          <Label htmlFor="select-all-permissions" className="font-medium cursor-pointer">Select All Permissions</Label>
        </div>
        {!hasEditPermission && (
          <p className="text-sm text-muted-foreground">View only - No edit permission</p>
        )}
      </div>
      {permissionError && (
        <p className="text-sm text-destructive">{permissionError}</p>
      )}

      {/* Header */}
      <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-muted rounded-lg font-medium text-sm">
        <div className="col-span-2">Module</div>
        <div className="text-center">Read</div>
        <div className="text-center">Create</div>
        <div className="text-center">Edit</div>
        <div className="text-center">Delete</div>
      </div>

      {/* Permission Rows */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {permissions
          .map((permission) => {
            const allChecked =
              permission.can_read &&
              permission.can_create &&
              permission.can_edit &&
              permission.can_delete;

            return (
              <div
                key={permission.module_id}
                className="grid grid-cols-6 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-muted/50 transition-colors"
              >
                <div className="col-span-2 flex items-center gap-2">
                  <Checkbox
                    id={`module-${permission.module_id}`}
                    checked={allChecked}
                    onCheckedChange={(checked) =>
                      handleSelectAll(permission.module_id, !!checked)
                    }
                    disabled={!hasEditPermission}
                  />
                  <Label htmlFor={`module-${permission.module_id}`} className="font-medium cursor-pointer">
                    {permission.name}
                  </Label>
                </div>
                <div className="flex justify-center">
                   
                  <Checkbox
                    checked={permission.can_read}
                    onCheckedChange={() =>
                      handleToggle(permission.module_id, "can_read")
                    }
                    disabled={!hasEditPermission}
                  />
                </div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={permission.can_create}
                    onCheckedChange={() =>
                      handleToggle(permission.module_id, "can_create")
                    }
                    disabled={!hasEditPermission}
                  />
                </div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={permission.can_edit}
                    onCheckedChange={() =>
                      handleToggle(permission.module_id, "can_edit")
                    }
                    disabled={!hasEditPermission}
                  />
                </div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={permission.can_delete}
                    onCheckedChange={() =>
                      handleToggle(permission.module_id, "can_delete")
                    }
                    disabled={!hasEditPermission}
                  />
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="secondary"
                  onClick={handleSavePermissions}
                  disabled={mutation.isPending || !hasEditPermission}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Permissions
                </Button>
              </div>
            </TooltipTrigger>
            {!hasEditPermission && (
              <TooltipContent>
                <p>You don't have permission to edit this user</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
