const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const ROOM_ORDER = ["Drawing Room", "Work Room 1", "Work Room 2"];

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function apiUrl(pathname) {
  const baseUrl = getApiBaseUrl();
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${suffix}`;
}

async function fetchJson(pathname) {
  const response = await fetch(apiUrl(pathname));
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json();
}

function groupDevicesByRoom(devices) {
  return ROOM_ORDER.map((roomName) => ({
    roomName,
    devices: devices.filter((device) => device.room === roomName),
  }));
}

function summarizeStatusPayload(devices, usage, alerts) {
  const rooms = groupDevicesByRoom(devices).map((room) => {
    const onDevices = room.devices.filter((device) => device.status);
    const wattage = room.devices.reduce(
      (sum, device) => sum + (device.status ? device.power_draw : 0),
      0
    );

    return {
      room: room.roomName,
      on_count: onDevices.length,
      total_count: room.devices.length,
      wattage,
      device_states: room.devices.map((device) => ({
        name: device.name,
        type: device.type,
        status: device.status ? "on" : "off",
      })),
    };
  });

  return {
    office: {
      device_count: devices.length,
      current_wattage: usage.total_wattage,
      estimated_kwh_today: usage.estimated_kwh_today,
      alert_count:
        alerts.device_alerts.length +
        alerts.room_alerts.length +
        alerts.after_hours_alerts.length,
    },
    rooms,
  };
}

function summarizeRoomPayload(roomPayload) {
  return {
    room: roomPayload.room,
    summary: roomPayload.summary,
    devices: roomPayload.devices.map((device) => ({
      name: device.name,
      type: device.type,
      status: device.status ? "on" : "off",
      wattage: device.power_draw,
      last_changed: device.last_changed,
    })),
  };
}

function summarizeUsagePayload(usagePayload) {
  return {
    total_wattage: usagePayload.total_wattage,
    estimated_kwh_today: usagePayload.estimated_kwh_today,
    room_breakdown: usagePayload.room_breakdown.map((room) => ({
      room: room.room,
      total_wattage: room.total_wattage,
      on_count: room.on_count,
      device_count: room.device_count,
    })),
  };
}

function getAlertKey(alert) {
  if (alert.kind === "room") {
    return `room:${alert.room?.code || alert.room?.name || "unknown"}:${alert.since || alert.timestamp}`;
  }

  if (alert.kind === "after_hours") {
    return `after_hours:${alert.device?.id || "unknown"}:${alert.device?.last_changed || alert.timestamp}`;
  }

  return `device:${alert.device?.id || "unknown"}:${alert.device?.last_changed || alert.timestamp}`;
}

function formatAlertLine(alert) {
  if (alert.kind === "room") {
    return `Room alert: ${alert.room.name} has been fully ON for more than 2 hours.`;
  }

  if (alert.kind === "after_hours") {
    return `After-hours alert: ${alert.device.name} is ON outside office hours.`;
  }

  return `Device alert: ${alert.device.name} has been ON for more than 2 hours.`;
}

function formatAlertSummary(alerts) {
  const lines = alerts.map((alert) => `- ${formatAlertLine(alert)}`);
  return [
    `Office Watch alert update: ${alerts.length} new alert${alerts.length === 1 ? "" : "s"} detected.`,
    ...lines,
  ].join("\n");
}

function fallbackStatusReply(summary) {
  const roomBits = summary.rooms.map(
    (room) => `${room.room}: ${room.on_count}/${room.total_count} on, ${room.wattage}W`
  );

  return [
    `Office is live right now: ${summary.office.device_count} devices, ${summary.office.current_wattage}W total, ${summary.office.alert_count} active alerts.`,
    roomBits.join(" | "),
  ].join(" ");
}

function fallbackRoomReply(roomPayload) {
  const active = roomPayload.devices.filter((device) => device.status === "on").length;
  return `${roomPayload.room.name} has ${active} of ${roomPayload.devices.length} devices on right now, drawing ${roomPayload.summary.total_wattage}W.`;
}

function fallbackUsageReply(usagePayload) {
  return `Office load is ${usagePayload.total_wattage}W right now, with an estimated ${usagePayload.estimated_kwh_today} kWh for today.`;
}

async function humanizeReply({ kind, data }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (kind === "status") return fallbackStatusReply(data);
    if (kind === "room") return fallbackRoomReply(data);
    return fallbackUsageReply(data);
  }

  try {
    const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: modelName });

    const prompts = {
      status: {
        system:
          "You are a helpful office monitoring assistant. Reply in 1-2 short, casual sentences. No JSON, no bullets, no markdown.",
        user: `Office snapshot data:\n${JSON.stringify(data, null, 2)}\n\nWrite a short human-friendly summary for Discord.`,
      },
      room: {
        system:
          "You are a helpful office monitoring assistant. Reply in 1-2 short, casual sentences. No JSON, no bullets, no markdown.",
        user: `Room status data:\n${JSON.stringify(data, null, 2)}\n\nWrite a short human-friendly room update for Discord.`,
      },
      usage: {
        system:
          "You are a helpful office monitoring assistant. Reply in 1-2 short, casual sentences. No JSON, no bullets, no markdown.",
        user: `Usage data:\n${JSON.stringify(data, null, 2)}\n\nWrite a short human-friendly usage update for Discord.`,
      },
    };

    const prompt = prompts[kind];
    const result = await model.generateContent([prompt.system, prompt.user].join("\n\n"));
    const text = result.response.text().trim();
    if (!text) {
      throw new Error("Empty Gemini response");
    }

    return text;
  } catch (error) {
    if (kind === "status") return fallbackStatusReply(data);
    if (kind === "room") return fallbackRoomReply(data);
    return fallbackUsageReply(data);
  }
}

async function buildStatusReply() {
  const [devices, usage, alerts] = await Promise.all([
    fetchJson("/api/devices"),
    fetchJson("/api/usage"),
    fetchJson("/api/alerts"),
  ]);

  const summary = summarizeStatusPayload(devices, usage, alerts);
  return humanizeReply({ kind: "status", data: summary });
}

async function buildRoomReply(roomName) {
  const roomPayload = await fetchJson(`/api/rooms/${encodeURIComponent(roomName)}`);
  return humanizeReply({ kind: "room", data: summarizeRoomPayload(roomPayload) });
}

async function buildUsageReply() {
  const usagePayload = await fetchJson("/api/usage");
  return humanizeReply({ kind: "usage", data: summarizeUsagePayload(usagePayload) });
}

module.exports = {
  buildRoomReply,
  buildStatusReply,
  buildUsageReply,
  fetchJson,
  formatAlertLine,
  formatAlertSummary,
  getAlertKey,
  getApiBaseUrl,
  humanizeReply,
  summarizeRoomPayload,
  summarizeStatusPayload,
  summarizeUsagePayload,
};

