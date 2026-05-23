import type { PeerFundingRecordInsert } from "@/types/database";
import type { PeerFundingRecordFormValues } from "@/components/dashboard/PeerFundingRecordFormDialog";

export function peerFundingRecordFormValuesToInsert(
  peerOrganizationId: string,
  values: PeerFundingRecordFormValues
): Omit<PeerFundingRecordInsert, "id" | "created_at" | "updated_at"> {
  return {
    peer_organization_id: peerOrganizationId,
    funder_name: values.funder_name,
    funder_id: values.funder_id || null,
    year: values.award_year === "" || values.award_year == null ? null : Number(values.award_year),
    award_year: values.award_year === "" || values.award_year == null ? null : Number(values.award_year),
    amount: values.amount_exact === "" || values.amount_exact == null ? null : Number(values.amount_exact),
    amount_exact: values.amount_exact === "" || values.amount_exact == null ? null : Number(values.amount_exact),
    amount_min: values.amount_min === "" || values.amount_min == null ? null : Number(values.amount_min),
    amount_max: values.amount_max === "" || values.amount_max == null ? null : Number(values.amount_max),
    purpose: values.purpose || null,
    program_area: values.program_area || null,
    source_url: values.source_url || null,
    confidence: values.confidence || "manual",
    source_metadata: {},
    notes: values.notes || null,
  };
}
