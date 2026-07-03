"use client";

import useSWR from "swr";

const fetcher = (url) => fetch(url).then((response) => {
  if (!response.ok) {
    throw new Error("Failed to load dashboard data");
  }

  return response.json();
});

const roomOrder = ["Drawing Room", "Work Room 1", "Work Room 2"];

function formatCurrencyNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function groupDevices(devices) {
  return roomOrder.map((roomName) => ({
    roomName,
    devices: devices.filter((device) => device.room === roomName),
  }));
}

function StatusDot({ on }) {
  return (
    <span
      className={[
        "inline-flex h-3 w-3 rounded-full",
        on ? "bg-orange-500 shadow-[0_0_0_6px_rgba(251,146,60,0.18)]" : "bg-stone-300",
      ].join(" ")}
    />
  );
}

function DeviceChip({ device }) {
  const isOn = device.status;

  return (
    <div
      className={[
        "rounded-2xl border p-3 transition",
        isOn
          ? "border-orange-200 bg-orange-50/80 shadow-[0_10px_24px_rgba(251,146,60,0.12)]"
          : "border-stone-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">{device.name}</p>
          <p className="text-xs text-stone-500">{device.type} · {device.id}</p>
        </div>
        <StatusDot on={isOn} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={[
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
            isOn
              ? "bg-orange-500 text-white"
              : "bg-stone-100 text-stone-500",
          ].join(" ")}
        >
          {isOn ? "ON" : "OFF"}
        </span>
        <span className="text-xs font-medium text-stone-500">{device.power_draw}W</span>
      </div>

      <p className="mt-3 text-xs text-stone-500">
        Last changed {formatTimestamp(device.last_changed)}
      </p>
    </div>
  );
}

function RoomCard({ roomName, devices }) {
  const onCount = devices.filter((device) => device.status).length;
  const roomWattage = devices.reduce((sum, device) => sum + (device.status ? device.power_draw : 0), 0);

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(120,113,108,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-stone-900">{roomName}</p>
          <p className="text-sm text-stone-500">
            {onCount} of {devices.length} devices on
          </p>
        </div>
        <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700">
          {roomWattage}W
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <DeviceChip key={device.id} device={device} />
        ))}
      </div>
    </section>
  );
}

function MeterCard({ usage }) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(120,113,108,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-stone-900">Live Power Consumption</p>
          <p className="text-sm text-stone-500">Updates with the current office load.</p>
        </div>
        <div className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
          {usage.total_wattage}W
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {usage.room_breakdown.map((room) => (
          <div key={room.room.code} className="rounded-2xl bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">{room.room.name}</p>
            <p className="mt-2 text-2xl font-bold text-stone-900">{room.total_wattage}W</p>
            <p className="mt-1 text-xs text-stone-500">
              {room.on_count} of {room.device_count} active
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-stone-100 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Estimated daily usage</p>
        <p className="mt-2 text-3xl font-semibold text-stone-900">{usage.estimated_kwh_today} kWh</p>
      </div>
    </section>
  );
}

function AlertCard({ alert }) {
  if (alert.kind === "room") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4">
        <p className="text-sm font-semibold text-red-700">Room alert</p>
        <p className="mt-1 text-sm text-stone-900">{alert.room.name} is fully ON for more than 2 hours.</p>
        <p className="mt-2 text-xs text-stone-500">
          Since {formatTimestamp(alert.since)} · Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  if (alert.kind === "after_hours") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4">
        <p className="text-sm font-semibold text-red-700">After-hours alert</p>
        <p className="mt-1 text-sm text-stone-900">{alert.device.name} is on outside office hours.</p>
        <p className="mt-2 text-xs text-stone-500">
          Logged {formatTimestamp(alert.timestamp)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-4">
      <p className="text-sm font-semibold text-red-700">Device alert</p>
      <p className="mt-1 text-sm text-stone-900">{alert.device.name} has been on for more than 2 hours.</p>
      <p className="mt-2 text-xs text-stone-500">
        Last changed {formatTimestamp(alert.last_changed)} · Logged {formatTimestamp(alert.timestamp)}
      </p>
    </div>
  );
}

function AlertsPanel({ alerts }) {
  const mergedAlerts = [
    ...alerts.device_alerts,
    ...alerts.room_alerts,
    ...alerts.after_hours_alerts,
  ];

  return (
    <section className="rounded-[28px] border border-red-200 bg-red-50/60 p-5 shadow-[0_18px_50px_rgba(120,113,108,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-red-900">Active Alerts</p>
          <p className="text-sm text-red-800/80">Timestamped warnings from the shared alert feed.</p>
        </div>
        <div className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          {mergedAlerts.length} active
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {mergedAlerts.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-stone-600">
            No active alerts right now.
          </div>
        ) : (
          mergedAlerts.map((alert, index) => <AlertCard key={`${alert.kind}-${index}`} alert={alert} />)
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const devices = useSWR("/api/devices", fetcher, { refreshInterval: 3000 });
  const usage = useSWR("/api/usage", fetcher, { refreshInterval: 3000 });
  const alerts = useSWR("/api/alerts", fetcher, { refreshInterval: 3000 });

  const roomGroups = groupDevices(devices.data || []);
  const loaded = devices.data && usage.data && alerts.data;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.12),_transparent_36%),linear-gradient(180deg,#f8f5ef_0%,#f4efe6_100%)] px-4 py-6 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-stone-200/80 bg-white/90 px-6 py-6 shadow-[0_20px_60px_rgba(120,113,108,0.10)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Office Watch
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Live office device monitor
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                A single source of truth for the simulated office, with live device states,
                power usage, and alert visibility for demos.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {roomOrder.map((roomName) => (
                <button
                  key={roomName}
                  type="button"
                  className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  {roomName}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!loaded ? (
          <div className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-[0_18px_50px_rgba(120,113,108,0.08)]">
            Loading live office data...
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(120,113,108,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-900">Live Device Status</p>
                    <p className="text-sm text-stone-500">Grouped by room and updated every 3 seconds.</p>
                  </div>
                  <div className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                    {devices.data.length} devices
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  {roomGroups.map((room) => (
                    <RoomCard key={room.roomName} roomName={room.roomName} devices={room.devices} />
                  ))}
                </div>
              </section>

              <MeterCard usage={usage.data} />
            </div>

            <AlertsPanel alerts={alerts.data} />
          </div>
        )}
      </div>
    </main>
  );
}

