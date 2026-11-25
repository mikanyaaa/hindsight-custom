import { NextRequest } from "next/server";
import { lowLevelClient, sdk } from "@/lib/hindsight-client";
import { respondWithSdk } from "@/lib/sdk-response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bankId: string; operationId: string }> }
) {
  const { bankId, operationId } = await params;
  const response = await sdk.deleteKnowledgeBankOperation({
    client: lowLevelClient,
    path: { bank_id: bankId, operation_id: operationId },
  });
  return respondWithSdk(response, "Failed to delete operation", { request });
}
