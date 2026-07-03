const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { DEVICE_LAYOUT } = require("./office");

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "office.db");

function getDatabasePath() {
  return process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
}

function ensureDatabaseDirectory(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function openDatabase(databasePath = getDatabasePath()) {
  ensureDatabaseDirectory(databasePath);

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return db;
}

function migrateDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Fan', 'Light')),
      name TEXT NOT NULL,
      status INTEGER NOT NULL DEFAULT 0 CHECK (status IN (0, 1)),
      power_draw INTEGER NOT NULL CHECK (power_draw >= 0),
      last_changed INTEGER NOT NULL
    );
  `);
}

function seedDevices(db, seedTimestamp = Date.now()) {
  const insertDevice = db.prepare(`
    INSERT OR IGNORE INTO devices (id, room, type, name, status, power_draw, last_changed)
    VALUES (@id, @room, @type, @name, @status, @power_draw, @last_changed)
  `);

  const insertMany = db.transaction((devices) => {
    for (const device of devices) {
      insertDevice.run({
        ...device,
        status: device.status ? 1 : 0,
        last_changed: device.last_changed ?? seedTimestamp,
      });
    }
  });

  insertMany(
    DEVICE_LAYOUT.map((device) => ({
      ...device,
      status: false,
      last_changed: seedTimestamp,
    }))
  );
}

function getAllDevices(db) {
  return db.prepare("SELECT * FROM devices ORDER BY room, type, name").all();
}

function getDeviceById(db, id) {
  return db.prepare("SELECT * FROM devices WHERE id = ?").get(id);
}

function updateDeviceStatus(db, id, status, lastChanged = Date.now()) {
  return db
    .prepare(
      "UPDATE devices SET status = ?, last_changed = ? WHERE id = ?"
    )
    .run(status ? 1 : 0, lastChanged, id);
}

function setDeviceState(db, id, nextState) {
  return db
    .prepare(
      "UPDATE devices SET status = ?, last_changed = ? WHERE id = ?"
    )
    .run(nextState.status ? 1 : 0, nextState.last_changed, id);
}

function initializeDatabase(databasePath = getDatabasePath()) {
  const db = openDatabase(databasePath);
  migrateDatabase(db);
  seedDevices(db);
  return db;
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  ensureDatabaseDirectory,
  getDatabasePath,
  initializeDatabase,
  getAllDevices,
  getDeviceById,
  migrateDatabase,
  openDatabase,
  setDeviceState,
  seedDevices,
  updateDeviceStatus,
};
