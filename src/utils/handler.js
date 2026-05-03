const fs = require("fs");
const path = require("path");

function getJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((file) => file.isFile() && file.name.endsWith(".js"))
    .map((file) => path.join(dir, file.name));
}

function registerCommands(client) {
  const commandsDir = path.join(__dirname, "..", "commands");
  const commandFile = getJsFiles(commandsDir);

  for (const file of commandFile) {
    registerCommand(client, file);
  }
}

function registerCommand(client, file) {
  try {
    const command = require(file);

    if (!command?.data || typeof command?.execute !== "function") {
      console.error(`Invalid command at ${file}`);
      return;
    }

    client.commands.set(command.data.name, command);
    console.log(`Registered command: ${command.data.name}`);
  } catch (error) {
    console.error(`Error loading command at ${file}:`, error);
  }
}

function registerEvents(client) {
  const eventsDir = path.join(__dirname, "..", "events");
  if (!fs.existsSync(eventsDir)) return;

  client.events ??= [];

  const eventFolders = fs
    .readdirSync(eventsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const folder of eventFolders) {
    const eventName = folder.name;
    const eventFolderPath = path.join(eventsDir, folder.name);
    const eventFiles = getJsFiles(eventFolderPath);

    for (const file of eventFiles) {
      registerEvent(client, eventName, file);
    }
  }
}

function registerEvent(client, eventName, file) {
  const eventPath = `${eventName}/${path.basename(file, ".js")}`;

  try {
    const event = require(file);
    const execute = typeof event === "function" ? event : event?.execute;

    if (typeof execute !== "function") {
      console.error(`Invalid event at ${file}`);
      return;
    }

    client.events.push({ name: eventPath, execute });

    const method = eventName === "ready" ? "once" : "on";
    client[method](eventName, (...args) => execute(...args));

    console.log(`Registered event: ${eventPath}`);
  } catch (error) {
    console.error(`Error loading event at ${file}:`, error);
  }
}

function registerHandlers(client) {
  registerCommands(client);
  registerEvents(client);
}

module.exports = { registerHandlers };
