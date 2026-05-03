const { Client, GatewayIntentBits, Events, Collection } = require("discord.js");
const { getKnowledgeVectorStore } = require("./rag/vector-store");
const { registerHandlers } = require("./utils/handler");
require("dotenv").config();
const { BOT_TOKEN } = process.env;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN in .env.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.on(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);

  getKnowledgeVectorStore().catch((error) => {
    console.error("Failed to warm up RAG knowledge base:", error);
  });
});

client.commands = new Collection();

registerHandlers(client);

client.login(BOT_TOKEN);
