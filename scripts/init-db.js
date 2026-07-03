#!/usr/bin/env node

const { initializeDatabase, getDatabasePath } = require("../lib/db");

const db = initializeDatabase();
const count = db.prepare("SELECT COUNT(*) AS count FROM devices").get().count;

console.log(`Initialized database at ${getDatabasePath()}`);
console.log(`Seeded ${count} devices.`);

db.close();

