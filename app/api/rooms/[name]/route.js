import officeApi from "../../../../lib/office-api.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request, { params }) {
  try {
    const roomName = decodeURIComponent(params.name);
    const payload = officeApi.withDatabase((db) => officeApi.getRoomSnapshot(db, roomName));

    if (!payload) {
      return Response.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: "Failed to load room" },
      { status: 500 }
    );
  }
}
