const { ROOMS } = require("./office");
const {
  getAllDevices,
  openDatabase,
} = require("./db");

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function toIso(timestamp) {
  return new Date(timestamp).toISOString();
}

function toDevicePayload(device) {
  return {
    id: device.id,
    room: device.room,
    type: device.type,
    name: device.name,
    status: Boolean(device.status),
    power_draw: device.power_draw,
    last_changed: toIso(device.last_changed),
  };
}

function getRoomMeta(roomName) {
  return ROOMS.find((room) => room.name.toLowerCase() === roomName.toLowerCase()) || null;
}

function groupDevicesByRoom(devices) {
  return ROOMS.map((room) => ({
    ...room,
    devices: devices.filter((device) => device.room === room.name),
  }));
}

function summarizeRoom(room, devices, now) {
  const totalWattage = devices.reduce((sum, device) => sum + (device.status ? device.power_draw : 0), 0);
  const onDevices = devices.filter((device) => device.status);
  const oldestOnAgeMs = onDevices.length > 0
    ? Math.min(...onDevices.map((device) => now - device.last_changed))
    : null;

  return {
    room: {
      name: room.name,
      code: room.code,
    },
    summary: {
      device_count: devices.length,
      on_count: onDevices.length,
      off_count: devices.length - onDevices.length,
      total_wattage: totalWattage,
      all_on: onDevices.length === devices.length && devices.length > 0,
      all_on_for_over_2_hours: Boolean(onDevices.length === devices.length && devices.length > 0 && oldestOnAgeMs !== null && oldestOnAgeMs > TWO_HOURS_MS),
    },
    devices: devices.map(toDevicePayload),
  };
}

function getDevicesSnapshot(db) {
  return getAllDevices(db).map(toDevicePayload);
}

function getRoomSnapshot(db, roomName, now = Date.now()) {
  const room = getRoomMeta(roomName);
  if (!room) {
    return null;
  }

  const devices = db.prepare("SELECT * FROM devices WHERE room = ? ORDER BY type, name").all(room.name);
  return summarizeRoom(room, devices, now);
}

function getUsageSnapshot(db) {
  const now = Date.now();
  const devices = getAllDevices(db);
  const rooms = groupDevicesByRoom(devices).map((room) => {
    const wattage = room.devices.reduce((sum, device) => sum + (device.status ? device.power_draw : 0), 0);

    return {
      room: {
        name: room.name,
        code: room.code,
      },
      device_count: room.devices.length,
      on_count: room.devices.filter((device) => device.status).length,
      total_wattage: wattage,
    };
  });

  const totalWattage = rooms.reduce((sum, room) => sum + room.total_wattage, 0);

  return {
    total_wattage: totalWattage,
    estimated_kwh_today: Number(((totalWattage * 24) / 1000).toFixed(2)),
    room_breakdown: rooms,
    generated_at: toIso(now),
  };
}

function parseHour(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return fallback;
  }

  return parsed;
}

function isWithinOfficeHours(date, startHour, endHour) {
  const currentHour = date.getHours();

  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }

  return currentHour >= startHour || currentHour < endHour;
}

function getAlertsSnapshot(db, options = {}) {
  const now = options.now || Date.now();
  const officeHoursStart = parseHour(options.officeHoursStart, 9);
  const officeHoursEnd = parseHour(options.officeHoursEnd, 17);
  const nowDate = new Date(now);
  const devices = getAllDevices(db);
  const byRoom = groupDevicesByRoom(devices);

  const deviceAlerts = devices
    .filter((device) => device.status && now - device.last_changed > TWO_HOURS_MS)
    .map((device) => ({
      kind: "device",
      reason: "device_on_over_2_hours",
      timestamp: toIso(now),
      last_changed: toIso(device.last_changed),
      device: toDevicePayload(device),
    }));

  const roomAlerts = byRoom
    .filter((room) => room.devices.length > 0 && room.devices.every((device) => device.status))
    .filter((room) => room.devices.every((device) => now - device.last_changed > TWO_HOURS_MS))
    .map((room) => {
      const oldestChanged = Math.min(...room.devices.map((device) => device.last_changed));
      const totalWattage = room.devices.reduce((sum, device) => sum + device.power_draw, 0);

      return {
        kind: "room",
        reason: "room_all_on_over_2_hours",
        timestamp: toIso(now),
        since: toIso(oldestChanged),
        room: {
          name: room.name,
          code: room.code,
        },
        devices: room.devices.map(toDevicePayload),
        total_wattage: totalWattage,
      };
    });

  const afterHoursAlerts = isWithinOfficeHours(nowDate, officeHoursStart, officeHoursEnd)
    ? []
    : devices
        .filter((device) => device.status)
        .map((device) => ({
          kind: "after_hours",
          reason: "after_hours_on",
          timestamp: toIso(now),
          device: toDevicePayload(device),
        }));

  return {
    generated_at: toIso(now),
    office_hours: {
      start: officeHoursStart,
      end: officeHoursEnd,
    },
    device_alerts: deviceAlerts,
    room_alerts: roomAlerts,
    after_hours_alerts: afterHoursAlerts,
  };
}

function withDatabase(handler) {
  const db = openDatabase();

  try {
    return handler(db);
  } finally {
    db.close();
  }
}

module.exports = {
  getAlertsSnapshot,
  getDevicesSnapshot,
  getRoomMeta,
  getRoomSnapshot,
  getUsageSnapshot,
  parseHour,
  withDatabase,
};

