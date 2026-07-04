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
  getApiBaseUrl,
} = require("./office-bot");

const PREFIX = "!";

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
        `I couldn't find that room. Try one of: Drawing Room, Work Room 1, or Work Room 2.`
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

  client.once("ready", () => {
    console.log(`Bot ready as ${client.user.tag}`);
    console.log(`Using API base ${getApiBaseUrl()}`);
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

  await client.login(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

