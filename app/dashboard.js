"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

// --- BACKEND LOGIC (UNTOUCHED) ---
const fetcher = (url) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("Failed to load dashboard data");
    }
    return response.json();
  });

const roomOrder = ["Drawing Room", "Work Room 1", "Work Room 2"];
const roomCodes = {
  "Drawing Room": "DR",
  "Work Room 1": "WR1",
  "Work Room 2": "WR2",
};

const roomBackgrounds = {
  "Drawing Room": "/office.png", 
  "Work Room 1": "/office-r.png",
  "Work Room 2": "/office-r.png",
};

const roomLayouts = {
  "Drawing Room": [
    { key: "F1", label: "Fan 1", x: 50, y: 40 },
    { key: "F2", label: "Fan 2", x: 25, y: 75 },
    { key: "L1", label: "Light 1", x: 15, y: 25 },
    { key: "L2", label: "Light 2", x: 85, y: 20 },
    { key: "L3", label: "Light 3", x: 80, y: 85 },
  ],
  "Work Room 1": [
    { key: "L1", label: "Light 1", x: 18, y: 22 }, 
    { key: "F1", label: "Fan 1", x: 45, y: 45 }, 
    { key: "F2", label: "Fan 2", x: 45, y: 75 }, 
    { key: "L2", label: "Light 2", x: 72, y: 35 }, 
    { key: "L3", label: "Light 3", x: 85, y: 80 }, 
  ],
  "Work Room 2": [
    { key: "L1", label: "Light 1", x: 18, y: 22 }, 
    { key: "F1", label: "Fan 1", x: 45, y: 45 }, 
    { key: "F2", label: "Fan 2", x: 45, y: 75 }, 
    { key: "L2", label: "Light 2", x: 72, y: 35 }, 
    { key: "L3", label: "Light 3", x: 85, y: 80 }, 
  ]
};

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

// NEW: Calculates exact time difference for real-time alerts
function formatDuration(start, end) {
  const diffMs = new Date(end) - new Date(start);
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

function groupDevicesByRoom(devices) {
  return roomOrder.map((roomName) => ({
    roomName,
    roomCode: roomCodes[roomName],
    devices: devices.filter((device) => device.room === roomName),
  }));
}

function getRoomStats(devices, roomName) {
  const roomDevices = devices.filter((device) => device.room === roomName);
  const onCount = roomDevices.filter((device) => device.status).length;
  const wattage = roomDevices.reduce(
    (sum, device) => sum + (device.status ? device.power_draw : 0),
    0
  );

  return {
    total: roomDevices.length,
    onCount,
    wattage,
  };
}

function getOverview(devices, alerts) {
  const onCount = devices.filter((device) => device.status).length;
  const totalWattage = devices.reduce(
    (sum, device) => sum + (device.status ? device.power_draw : 0),
    0
  );

  return {
    deviceCount: devices.length,
    onCount,
    totalWattage,
    alertCount:
      alerts.device_alerts.length +
      alerts.room_alerts.length +
      alerts.after_hours_alerts.length,
  };
}
// --- END BACKEND LOGIC ---

// --- UI COMPONENTS ---
function FanIcon({ active }) {
  return (
    <div
      className={[
        "flex h-12 w-12 items-center justify-center rounded-full border bg-stone-50",
        active
          ? "border-amber-300 text-amber-600 shadow-[0_4px_16px_rgba(217,119,6,0.15)] animate-fan-spin"
          : "border-stone-200 text-stone-300",
      ].join(" ")}
    >
      <svg viewBox="0 0 64 64" className="h-7 w-7" fill="none">
        <circle cx="32" cy="32" r="5" fill="currentColor" />
        <path d="M32 13c-4 0-7 3-7 7 0 2 1 4 3 5l5 2 4-7c0-4-3-7-5-7Z" fill="currentColor" opacity="0.95" />
        <path d="M51 32c0-4-3-7-7-7-2 0-4 1-5 3l-2 5 7 4c4 0 7-3 7-5Z" fill="currentColor" opacity="0.95" />
        <path d="M32 51c4 0 7-3 7-7 0-2-1-4-3-5l-5-2-4 7c0 4 3 7 5 7Z" fill="currentColor" opacity="0.95" />
        <path d="M13 32c0 4 3 7 7 7 2 0 4-1 5-3l2-5-7-4c-4 0-7 3-7 5Z" fill="currentColor" opacity="0.95" />
      </svg>
    </div>
  );
}

function LightIcon({ active }) {
  return (
    <div
      className={[
        "flex h-12 w-12 items-center justify-center rounded-full border bg-stone-50",
        active
          ? "border-amber-300 text-amber-500 shadow-[0_4px_16px_rgba(217,119,6,0.25)] animate-light-glow"
          : "border-stone-200 text-stone-300",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full",
          active ? "bg-amber-400" : "bg-stone-200",
        ].join(" ")}
      >
        <div className="h-2 w-2 rounded-full bg-stone-50" />
      </div>
    </div>
  );
}

function DeviceNode({ device, x, y }) {
  const active = Boolean(device.status);

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {device.type === "Fan" ? <FanIcon active={active} /> : <LightIcon active={active} />}

      <div
        className={[
          "rounded-sm border px-2.5 py-1.5 text-center bg-stone-50/95 backdrop-blur shadow-sm",
          active ? "border-amber-300" : "border-stone-200",
        ].join(" ")}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-800">
          {device.name}
        </p>
        <p
          className={[
            "mt-0.5 text-[10px] font-bold",
            active ? "text-amber-600" : "text-stone-400",
          ].join(" ")}
        >
          {device.status ? `${device.power_draw}W ON` : "OFF"}
        </p>
      </div>
    </div>
  );
}

function RoomScene({ roomName, devices }) {
  const roomCode = roomCodes[roomName];
  const stats = getRoomStats(devices, roomName);
  
  const sceneDevices = useMemo(() => {
    const currentSlots = roomLayouts[roomName] || roomLayouts["Drawing Room"];
    return currentSlots
      .map((slot) => ({
        ...slot,
        device: devices.find((item) => item.id === `${roomCode}_${slot.key}`),
      }))
      .filter((slot) => Boolean(slot.device));
  }, [devices, roomCode, roomName]); 

  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-stone-500">
            {roomName}
          </p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-stone-800">
            Live Blueprint
          </h2>
        </div>

        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
          {stats.wattage}W active
        </div>
      </div>

      <div className="relative mt-5 min-h-[540px] overflow-hidden rounded-md border border-stone-200 bg-stone-100">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 opacity-60 mix-blend-multiply filter sepia-[0.2]"
          style={{ backgroundImage: `url(${roomBackgrounds[roomName]})` }}
        />
        
        <div className="absolute inset-0 bg-stone-50/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.04),transparent_70%)]" />

        <div className="absolute left-4 top-4 rounded-sm border border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur shadow-sm z-20">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
            Room Status
          </p>
          <p className="mt-1 text-sm font-bold text-stone-800">
            {stats.onCount} of {stats.total} devices active
          </p>
        </div>

        {sceneDevices.map(({ device, x, y }) => (
          <DeviceNode key={device.id} device={device} x={x} y={y} />
        ))}
      </div>
    </section>
  );
}

function StatTile({ label, value, hint, accent = "text-stone-800" }) {
  return (
    <div className="rounded-sm border border-stone-200 bg-stone-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-stone-400">{hint}</p>
    </div>
  );
}

function AlertCard({ alert }) {
  if (alert.kind === "room") {
    return (
      <div className="rounded-sm border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
        <p className="text-sm font-bold text-rose-700">Area Alert</p>
        <p className="mt-1 text-sm font-medium text-stone-800">
          <span className="font-bold text-stone-900">{alert.room.name}</span> has been fully ON for <span className="font-bold text-rose-600">{formatDuration(alert.since, alert.timestamp)}</span>.
        </p>
        <p className="mt-2 text-xs font-medium text-stone-500">
          Since {formatTimestamp(alert.since)} | Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  if (alert.kind === "after_hours") {
    return (
      <div className="rounded-sm border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
        <p className="text-sm font-bold text-rose-700">Schedule Violation</p>
        <p className="mt-1 text-sm font-medium text-stone-800">
          <span className="font-bold text-stone-900">{alert.device.room}:</span> {alert.device.name} is active outside office hours.
        </p>
        <p className="mt-2 text-xs font-medium text-stone-500">
          Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
      <p className="text-sm font-bold text-rose-700">Device Alert</p>
      <p className="mt-1 text-sm font-medium text-stone-800">
        <span className="font-bold text-stone-900">{alert.device.room}:</span> {alert.device.name} has been active for <span className="font-bold text-rose-600">{formatDuration(alert.last_changed, alert.timestamp)}</span>.
      </p>
      <p className="mt-2 text-xs font-medium text-stone-500">
        Last changed {formatTimestamp(alert.last_changed)} | Logged {formatTimestamp(alert.timestamp)}
      </p>
    </div>
  );
}

function SidePanel({ usage, alerts }) {
  const mergedAlerts = [
    ...alerts.device_alerts,
    ...alerts.room_alerts,
    ...alerts.after_hours_alerts,
  ];

  return (
    <aside className="space-y-5">
      <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-stone-500">
              Live Snapshot
            </p>
            <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-stone-800">
              Grid Overview
            </h3>
          </div>
          <div className="rounded-sm bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
            {mergedAlerts.length} notices
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatTile
            label="Current draw"
            value={`${usage.total_wattage}W`}
            hint="Active wattage across grid"
            accent="text-amber-700"
          />
          <StatTile
            label="Daily Estimate"
            value={`${usage.estimated_kwh_today} kWh`}
            hint="Projected energy usage for today"
          />
        </div>
      </section>

      <section className="rounded-md border border-rose-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-rose-600/80">
              System Flags
            </p>
            <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-stone-800">
              Active Alerts
            </h3>
          </div>
          <div className="rounded-sm bg-rose-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
            {mergedAlerts.length}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {mergedAlerts.length === 0 ? (
            <div className="rounded-sm border border-stone-200 bg-stone-50 p-4 text-sm font-medium text-stone-500 shadow-sm">
              All systems nominal. No alerts.
            </div>
          ) : (
            mergedAlerts.map((alert, index) => (
              <AlertCard key={`${alert.kind}-${index}`} alert={alert} />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

export default function Dashboard() {
  const devices = useSWR("/api/devices", fetcher, { refreshInterval: 3000 });
  const usage = useSWR("/api/usage", fetcher, { refreshInterval: 3000 });
  const alerts = useSWR("/api/alerts", fetcher, { refreshInterval: 3000 });
  const [selectedRoom, setSelectedRoom] = useState(roomOrder[0]);

  const loaded = devices.data && usage.data && alerts.data;

  const roomGroups = useMemo(
    () => groupDevicesByRoom(devices.data || []),
    [devices.data]
  );

  const overview = useMemo(
    () => getOverview(devices.data || [], alerts.data || {
      device_alerts: [],
      room_alerts: [],
      after_hours_alerts: [],
    }),
    [devices.data, alerts.data]
  );

  const selectedRoomDevices = useMemo(
    () => (devices.data || []).filter((device) => device.room === selectedRoom),
    [devices.data, selectedRoom]
  );

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-5 font-sans sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-md border border-stone-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-600">
                Office Watch
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-stone-800 sm:text-4xl">
                Telemetry Center
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-stone-500">
                A live, top-down schematic of the physical office space. Hardware states update 
                dynamically every 3 seconds directly from the central SQLite hub.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
              <div className="rounded-sm border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                  Active Devices
                </p>
                <p className="mt-1 text-2xl font-bold text-stone-800">{overview.onCount}</p>
              </div>
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                  Grid Load
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-700">
                  {overview.totalWattage}W
                </p>
              </div>
              <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">
                  Flagged Alerts
                </p>
                <p className="mt-1 text-2xl font-bold text-rose-700">
                  {overview.alertCount}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {roomGroups.map(({ roomName, devices: roomDevices }) => {
            const stats = getRoomStats(devices.data || [], roomName);
            const active = selectedRoom === roomName;

            return (
              <button
                key={roomName}
                type="button"
                onClick={() => setSelectedRoom(roomName)}
                className={[
                  "flex min-w-[170px] items-center justify-between gap-4 rounded-sm border px-5 py-3 text-left transition-all",
                  active
                    ? "border-stone-800 bg-[#2B2D42] text-stone-50 shadow-md"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                ].join(" ")}
              >
                <span className="text-sm font-bold">{roomName}</span>
                <span
                  className={[
                    "rounded-sm px-2 py-1 text-[10px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500",
                  ].join(" ")}
                >
                  {stats.onCount}/{roomDevices.length}
                </span>
              </button>
            );
          })}
        </div>

        {!loaded ? (
          <div className="rounded-md border border-stone-200 bg-white p-6 text-sm font-medium text-stone-500 shadow-sm">
            Loading telemetry data...
          </div>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <RoomScene roomName={selectedRoom} devices={selectedRoomDevices} />
            <SidePanel usage={usage.data} alerts={alerts.data} />
          </section>
        )}
      </div>
    </main>
  );
}