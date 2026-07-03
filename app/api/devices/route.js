import officeApi from "../../../lib/office-api.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const devices = officeApi.withDatabase((db) => officeApi.getDevicesSnapshot(db));
    return Response.json(devices);
  } catch (error) {
    return Response.json(
      { error: "Failed to load devices" },
      { status: 500 }
    );
  }
}
