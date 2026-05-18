import { useAuth } from "@/contexts/AuthContext";
import {
  canWrite,
  canContribute,
  canWriteTable,
  canCreateTable,
  canUpdateTable,
  canDeleteRecords,
  isViewer,
  isAdmin,
  type WritableTable,
} from "@/lib/roles";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return {
    role,
    canWrite: canWrite(role),
    canContribute: canContribute(role),
    canDeleteRecords: canDeleteRecords(role),
    isViewer: isViewer(role),
    isAdmin: isAdmin(role),
    canWriteTable: (table: WritableTable) => canWriteTable(role, table),
    canCreateTable: (table: WritableTable) => canCreateTable(role, table),
    canUpdateTable: (table: WritableTable) => canUpdateTable(role, table),
  };
}
