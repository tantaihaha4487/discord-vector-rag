module.exports = async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  try {
    if (!command)
      return console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    const reply = {
      content: "There was an error while executing this command!",
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
        return;
      }

      await interaction.reply(reply);
    } catch (replyError) {
      if (isExpiredInteraction(replyError)) {
        console.warn(
          `Could not respond to expired interaction for ${interaction.commandName}.`,
        );
        return;
      }

      throw replyError;
    }
  }
};

function isExpiredInteraction(error) {
  return error?.code === 10062 || error?.code === 40060;
}
