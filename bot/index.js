require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const {
  buildRoomReply,
  buildStatusReply,
  buildUsageReply,
  fetchJson,
  formatAlertSummary,
  getAlertKey,
  getApiBaseUrl,
} = require("./office-bot");

const PREFIX = "!";
const ALERT_POLL_INTERVAL_MS = 10 * 60 * 1000;

function normalizeCommand(messageContent) {
  if (!messageContent.startsWith(PREFIX)) {
    return null;
  }

  const [command, ...args] = messageContent.slice(PREFIX.length).trim().split(/\s+/);
  return {
    command: (command || "").toLowerCase(),
    args,
    rawArgs: args.join(" ").trim(),
  };
}

async function safeReply(message, text) {
  if (message.channel?.send) {
    await message.reply({ content: text });
    return;
  }

  await message.author?.send?.(text);
}

function flattenAlerts(alertPayload) {
  return [
    ...(alertPayload.device_alerts || []),
    ...(alertPayload.room_alerts || []),
    ...(alertPayload.after_hours_alerts || []),
  ];
}

async function seedKnownAlerts(knownAlertKeys) {
  const alerts = await fetchJson("/api/alerts");
  for (const alert of flattenAlerts(alerts)) {
    knownAlertKeys.add(getAlertKey(alert));
  }
}

async function sendAlertDigest(client, alerts) {
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  if (!channelId) {
    console.warn("DISCORD_ALERT_CHANNEL_ID is not set; skipping proactive alerts.");
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || typeof channel.send !== "function") {
    console.warn(`Alert channel ${channelId} is not a text channel.`);
    return;
  }

  await channel.send(formatAlertSummary(alerts));
}

async function pollAlerts(client, knownAlertKeys) {
  const alertPayload = await fetchJson("/api/alerts");
  const allAlerts = flattenAlerts(alertPayload);
  const newAlerts = allAlerts.filter((alert) => {
    const key = getAlertKey(alert);
    if (knownAlertKeys.has(key)) {
      return false;
    }

    knownAlertKeys.add(key);
    return true;
  });

  if (newAlerts.length === 0) {
    return;
  }

  await sendAlertDigest(client, newAlerts);
}

function buildHelpText() {
  return [
    "Try `!status` for the full office, `!room <name>` for one room, or `!usage` for the current load.",
    `API base: ${getApiBaseUrl()}`,
  ].join(" ");
}

async function handleCommand(message, commandData) {
  const { command, rawArgs } = commandData;

  if (command === "status") {
    const reply = await buildStatusReply();
    return safeReply(message, reply);
  }

  if (command === "room") {
    if (!rawArgs) {
      return safeReply(message, "Please provide a room name, like `!room Drawing Room`.");
    }

    try {
      const reply = await buildRoomReply(rawArgs);
      return safeReply(message, reply);
    } catch (error) {
      return safeReply(
        message,
        "I couldn't find that room. Try one of: Drawing Room, Work Room 1, or Work Room 2."
      );
    }
  }

  if (command === "usage") {
    const reply = await buildUsageReply();
    return safeReply(message, reply);
  }

  if (command === "help") {
    return safeReply(message, buildHelpText());
  }

  return null;
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is required.");
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  const knownAlertKeys = new Set();
  let alertPollingInFlight = false;
  let alertPollingInterval = null;

  async function runAlertPoll() {
    if (alertPollingInFlight) {
      return;
    }

    alertPollingInFlight = true;
    try {
      await pollAlerts(client, knownAlertKeys);
    } catch (error) {
      console.error("Alert poll failed:", error);
    } finally {
      alertPollingInFlight = false;
    }
  }

  client.once("ready", async () => {
    console.log(`Bot ready as ${client.user.tag}`);
    console.log(`Using API base ${getApiBaseUrl()}`);

    try {
      await seedKnownAlerts(knownAlertKeys);
      await runAlertPoll();
    } catch (error) {
      console.error("Failed to prime alert watcher:", error);
    }

    alertPollingInterval = setInterval(() => {
      runAlertPoll().catch((error) => {
        console.error("Alert poll interval failed:", error);
      });
    }, ALERT_POLL_INTERVAL_MS);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) {
      return;
    }

    const commandData = normalizeCommand(message.content);
    if (!commandData) {
      return;
    }

    try {
      const handled = await handleCommand(message, commandData);
      if (!handled && commandData.command === "help") {
        return;
      }

      if (!handled && !["status", "room", "usage", "help"].includes(commandData.command)) {
        await safeReply(message, "Unknown command. Try `!help`.");
      }
    } catch (error) {
      console.error("Command failed:", error);
      await safeReply(message, "Sorry, I couldn't fetch the latest office data just now.");
    }
  });

  const shutdown = async () => {
    if (alertPollingInterval) {
      clearInterval(alertPollingInterval);
    }

    try {
      await client.destroy();
    } catch {
      // ignore shutdown errors
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

