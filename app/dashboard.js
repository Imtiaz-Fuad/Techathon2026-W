"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

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

const sceneSlots = [
  { key: "L1", label: "Light 1", x: 50, y: 14 },
  { key: "F1", label: "Fan 1", x: 28, y: 48 },
  { key: "F2", label: "Fan 2", x: 72, y: 48 },
  { key: "L2", label: "Light 2", x: 22, y: 80 },
  { key: "L3", label: "Light 3", x: 78, y: 80 },
];

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
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

function StatusBadge({ on }) {
  return (
    <span
      className={[
        "inline-flex h-3 w-3 rounded-full",
        on
          ? "bg-orange-400 shadow-[0_0_0_6px_rgba(251,146,60,0.18)]"
          : "bg-slate-500/70",
      ].join(" ")}
    />
  );
}

function FanIcon({ active }) {
  return (
    <div
      className={[
        "flex h-14 w-14 items-center justify-center rounded-full border",
        active
          ? "border-orange-300/40 bg-orange-500/10 text-orange-300 shadow-[0_0_24px_rgba(251,146,60,0.22)] animate-fan-spin"
          : "border-white/10 bg-white/5 text-slate-500",
      ].join(" ")}
    >
      <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none">
        <circle cx="32" cy="32" r="5" fill="currentColor" />
        <path
          d="M32 13c-4 0-7 3-7 7 0 2 1 4 3 5l5 2 4-7c0-4-3-7-5-7Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M51 32c0-4-3-7-7-7-2 0-4 1-5 3l-2 5 7 4c4 0 7-3 7-5Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M32 51c4 0 7-3 7-7 0-2-1-4-3-5l-5-2-4 7c0 4 3 7 5 7Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M13 32c0 4 3 7 7 7 2 0 4-1 5-3l2-5-7-4c-4 0-7 3-7 5Z"
          fill="currentColor"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}

function LightIcon({ active }) {
  return (
    <div
      className={[
        "flex h-14 w-14 items-center justify-center rounded-full border",
        active
          ? "border-orange-200/70 bg-orange-300/15 text-orange-100 shadow-[0_0_26px_rgba(251,146,60,0.42)] animate-light-glow"
          : "border-white/10 bg-white/5 text-slate-500",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full",
          active ? "bg-orange-300/95" : "bg-slate-600/70",
        ].join(" ")}
      >
        <div className="h-3 w-3 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

function DeviceNode({ device, x, y }) {
  const active = Boolean(device.status);

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {device.type === "Fan" ? <FanIcon active={active} /> : <LightIcon active={active} />}

      <div
        className={[
          "rounded-2xl border px-3 py-2 text-center backdrop-blur",
          active
            ? "border-orange-300/25 bg-slate-950/80 shadow-[0_0_20px_rgba(251,146,60,0.15)]"
            : "border-white/10 bg-slate-950/60",
        ].join(" ")}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
          {device.name}
        </p>
        <p
          className={[
            "mt-1 text-[10px] font-semibold",
            active ? "text-orange-300" : "text-slate-400",
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
    return sceneSlots
      .map((slot) => ({
        ...slot,
        device: devices.find((item) => item.id === `${roomCode}_${slot.key}`),
      }))
      .filter((slot) => Boolean(slot.device));
  }, [devices, roomCode]);

  return (
    <section className="rounded-[32px] border border-white/10 bg-slate-950/85 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">
            {roomName}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
            Live top-down view
          </h2>
        </div>

        <div className="rounded-full border border-orange-300/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
          {stats.wattage}W active
        </div>
      </div>

      <div
        className="relative mt-5 min-h-[540px] overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_42%),linear-gradient(180deg,#1a2027_0%,#11151b_100%)]"
      >
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:80px_80px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.08),transparent_62%)]" />

        <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Room status
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {stats.onCount} of {stats.total} devices on
          </p>
        </div>

        {sceneDevices.map(({ device, x, y }) => (
          <DeviceNode key={device.id} device={device} x={x} y={y} />
        ))}
      </div>
    </section>
  );
}

function StatTile({ label, value, hint, accent = "text-slate-100" }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function AlertCard({ alert }) {
  if (alert.kind === "room") {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-slate-950/70 p-4">
        <p className="text-sm font-semibold text-red-300">Room alert</p>
        <p className="mt-1 text-sm text-slate-100">
          {alert.room.name} is fully ON for more than 2 hours.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Since {formatTimestamp(alert.since)} | Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  if (alert.kind === "after_hours") {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-slate-950/70 p-4">
        <p className="text-sm font-semibold text-red-300">After-hours alert</p>
        <p className="mt-1 text-sm text-slate-100">
          {alert.device.name} is on outside office hours.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-red-300">Device alert</p>
      <p className="mt-1 text-sm text-slate-100">
        {alert.device.name} has been on for more than 2 hours.
      </p>
      <p className="mt-2 text-xs text-slate-400">
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
      <section className="rounded-[32px] border border-white/10 bg-slate-950/85 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">
              Live snapshot
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
              Office at a glance
            </h3>
          </div>
          <div className="rounded-full bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
            {mergedAlerts.length} alerts
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatTile
            label="Current load"
            value={`${usage.total_wattage}W`}
            hint="Live wattage across all rooms"
            accent="text-orange-200"
          />
          <StatTile
            label="Today"
            value={`${usage.estimated_kwh_today} kWh`}
            hint="Estimated energy usage for the day"
          />
        </div>
      </section>

      <section className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-red-200/80">
              Active alerts
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-red-50">
              What needs attention
            </h3>
          </div>
          <div className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            {mergedAlerts.length}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {mergedAlerts.length === 0 ? (
            <div className="rounded-2xl border border-red-500/20 bg-slate-950/70 p-4 text-sm text-slate-300">
              No active alerts right now.
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(100,116,139,0.14),_transparent_34%),linear-gradient(180deg,#090d12_0%,#0e1218_100%)] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[34px] border border-white/10 bg-slate-950/80 px-6 py-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-orange-300/90">
                Office Watch
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Live office picture
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                A single live scene for the whole office. Fans spin when ON, lights glow when ON,
                and the room canvas updates every 3 seconds from the shared SQLite source of truth.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Devices on
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{overview.onCount}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Current wattage
                </p>
                <p className="mt-1 text-2xl font-semibold text-orange-200">
                  {overview.totalWattage}W
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Alerts
                </p>
                <p className="mt-1 text-2xl font-semibold text-red-200">
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
                  "flex min-w-[170px] items-center justify-between gap-4 rounded-full border px-5 py-3 text-left transition",
                  active
                    ? "border-white/20 bg-white text-slate-950 shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                ].join(" ")}
              >
                <span className="text-sm font-semibold">{roomName}</span>
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    active ? "bg-slate-900 text-white" : "bg-slate-900/70 text-slate-300",
                  ].join(" ")}
                >
                  {stats.onCount}/{roomDevices.length}
                </span>
              </button>
            );
          })}
        </div>

        {!loaded ? (
          <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-400 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
            Loading live office scene...
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

