import officeApi from "../../../lib/office-api.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const usage = officeApi.withDatabase((db) => officeApi.getUsageSnapshot(db));
    return Response.json(usage);
  } catch (error) {
    return Response.json(
      { error: "Failed to load usage" },
      { status: 500 }
    );
  }
}
