const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
require("dotenv").config();
const { BOT_TOKEN } = process.env;
const fs = require("fs");
const path = require("path");
const { getDiscordConfig } = require("../rag/config");

const { clientId, guildId } = getDiscordConfig();

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN in .env.");
}

if (!clientId || !guildId) {
  console.warn(
    "Skipping slash command deploy: set discord.clientId and discord.guildId in config.yaml to deploy commands.",
  );
  process.exit(0);
}

const commands = [];
const commandsPath = path.join(__dirname, "..", "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

rest
  .put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
  .then((data) =>
    console.log(`Successfully registered ${data.length} application commands.`)
  )
  .catch(console.error);
