#!/usr/bin/env node

require("dotenv").config();

const { initializeDatabase, getAllDevices, updateDeviceStatus } = require("./lib/db");

const DEFAULT_INTERVAL_MS = 7000;
const DEMO_DEVICE_ID = "DR_F1";
const DEMO_DURATION_MS = 3 * 60 * 60 * 1000;

function getTickIntervalMs() {
  const rawValue = Number(process.env.SIMULATOR_TICK_INTERVAL_MS);
  if (Number.isFinite(rawValue) && rawValue > 0) {
    return rawValue;
  }

  return DEFAULT_INTERVAL_MS;
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shouldFlipStatus() {
  return Math.random() < 0.45;
}

function seedDemoDevice(db) {
  const demoTimestamp = Date.now() - DEMO_DURATION_MS;
  updateDeviceStatus(db, DEMO_DEVICE_ID, true, demoTimestamp);
  console.log(`[seed] ${DEMO_DEVICE_ID} set ON with last_changed=${new Date(demoTimestamp).toISOString()}`);
}

function tick(db) {
  const devices = getAllDevices(db).filter((device) => device.id !== DEMO_DEVICE_ID);

  if (devices.length === 0) {
    return;
  }

  const device = pickRandomItem(devices);
  if (!shouldFlipStatus()) {
    console.log(`[tick] no change for ${device.id}`);
    return;
  }

  const nextStatus = !Boolean(device.status);
  const now = Date.now();
  updateDeviceStatus(db, device.id, nextStatus, now);
  console.log(
    `[tick] ${device.id} -> ${nextStatus ? "ON" : "OFF"} at ${new Date(now).toISOString()}`
  );
}

function main() {
  const intervalMs = getTickIntervalMs();
  const db = initializeDatabase();

  seedDemoDevice(db);

  console.log(`[start] simulator running every ${intervalMs}ms`);

  const interval = setInterval(() => {
    try {
      tick(db);
    } catch (error) {
      console.error("[tick] failed", error);
    }
  }, intervalMs);

  const shutdown = () => {
    clearInterval(interval);
    db.close();
    console.log("[stop] simulator stopped");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

