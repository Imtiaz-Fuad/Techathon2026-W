import officeApi from "../../../lib/office-api.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const alerts = officeApi.withDatabase((db) =>
      officeApi.getAlertsSnapshot(db, {
        officeHoursStart: process.env.OFFICE_HOURS_START,
        officeHoursEnd: process.env.OFFICE_HOURS_END,
      })
    );

    return Response.json(alerts);
  } catch (error) {
    return Response.json(
      { error: "Failed to load alerts" },
      { status: 500 }
    );
  }
}
