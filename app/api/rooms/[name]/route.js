import officeApi from "../../../../lib/office-api.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeRoomName(rawName) {
  if (typeof rawName !== "string" || rawName.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(rawName);
  } catch {
    return null;
  }
}

export function GET(_request, { params }) {
  try {
    const roomName = decodeRoomName(params?.name);

    if (!roomName) {
      return Response.json(
        { error: "Invalid room name" },
        { status: 400 }
      );
    }

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
