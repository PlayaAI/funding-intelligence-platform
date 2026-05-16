import type { PeerFundingRecordInsert } from "@/types/database";
import type { PeerFundingRecordFormValues } from "@/components/dashboard/PeerFundingRecordFormDialog";

export function peerFundingRecordFormValuesToInsert(
  peerOrganizationId: string,
  values: PeerFundingRecordFormValues
): Omit<PeerFundingRecordInsert, "id" | "created_at" | "updated_at"> {
  return {
    peer_organization_id: peerOrganizationId,
    funder_name: values.funder_name,
    year: values.year,
    amount: values.amount,
    source_url: values.source_url || null,
    notes: values.notes || null,
  };
}
