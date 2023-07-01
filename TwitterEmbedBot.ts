import { SlashCommandBuilder } from "@discordjs/builders";
import {
    CommandInteraction, Client, Message, GatewayIntentBits, EmbedBuilder,
    ContextMenuCommandBuilder,
    ActionRowBuilder,StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, BaseMessageOptions
} from "discord.js";
import { BotWithConfig } from "../../BotWithConfig";
import { DomainConverter } from "./DomainConverter";

type TwitterEmbedConfig = {
    replacementDomains: string[],
}

export class TwitterEmbedBot extends BotWithConfig {
    private static readonly STRING_SELECT_CUSTOM_ID = "twitterEmbedBotHostSelect";

    intents: GatewayIntentBits[];
    commands: (SlashCommandBuilder | ContextMenuCommandBuilder)[];

    private readonly config: TwitterEmbedConfig;

    constructor() {
        super("TwitterEmbedConfig", import.meta);
        this.config = this.readYamlConfig<TwitterEmbedConfig>("config.yaml");
        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        this.commands = [];
    }

    async processCommand(interaction: CommandInteraction): Promise<void> {
        return;
    }

    async useClient(client: Client): Promise<void> {
        client.on("messageCreate", async (message) => {
            if (client.user === null) {
                this.logger.warn("client.user is null");
                return;
            }

            if (message.author.id === client.user.id) {
                return;
            }

            await this.handleMessage(message);
        });

        client.on("interactionCreate", async (interaction) => {
            if (client.user === null) {
                this.logger.warn("client.user is null");
                return;
            }

            if (interaction.user.id === client.user.id) {
                return;
            }

            if (interaction.isStringSelectMenu()) {
                await this.handleStringSelectMenu(interaction);
            }
        });
    }

    private async handleStringSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
        if (interaction.customId === TwitterEmbedBot.STRING_SELECT_CUSTOM_ID) {
            await this.handleHostSwitch(interaction);
        }
    }

    private async handleHostSwitch(interaction: StringSelectMenuInteraction): Promise<void> {
        const newHost = interaction.values[0];
        this.logger.info(`String select switch host to ${newHost}`);
        const repliedRef = interaction.message.reference;
        if (repliedRef === null || repliedRef.messageId === undefined || interaction.channel === null) {
            this.logger.warn(`Could not find original message for interaction: ${interaction.id}`);
            await interaction.reply({
                embeds: [TwitterEmbedBot.createErrorEmbed("Error while switching host", "Could not find original message.")],
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({
            embeds: [TwitterEmbedBot.createProgressEmbed("Switching Host", `Switching host to ${newHost}`)]
        });

        try {
            const repliedMessage = await interaction.channel.messages.fetch(repliedRef.messageId);
            const result = await this.handleConversion(repliedMessage, newHost);
            if (result === null) {
                await interaction.message.edit({
                    content: interaction.message.content,
                    components: interaction.message.components
                });
                await interaction.editReply({
                    embeds: [TwitterEmbedBot.createErrorEmbed("Error while switching host", "No Twitter URLs found.")]
                });
                return;
            }

            await interaction.message.edit(result);
        } catch (error) {
            this.logger.warn(`Error while switching host:\n${error}`);
            await interaction.message.edit({
                content: interaction.message.content,
                components: interaction.message.components
            });
            await interaction.editReply({
                embeds: [TwitterEmbedBot.createErrorEmbed("Error while switching host", "No Twitter URLs found.")]
            });
        }
    }

    private async handleMessage(message: Message): Promise<void> {
        try {
            this.logger.info(`Handling message: ${message.content}`);
            const result = await this.handleConversion(message, null);
            if (result === null) {
                return;
            }

            await message.reply(result);
        } catch (error) {
            this.logger.error(`Ran into error in handleMessage(), ignoring:\n${error}`);
        }
    }

    private async handleConversion(message: Message, newHost: string | null): Promise<BaseMessageOptions | null> {
        try {
            this.logger.info(`newHost: ${newHost}\nHandling message: ${message.content}`);
            if (newHost === null) {
                newHost = this.config.replacementDomains[0];
            }

            const convertedStr = await DomainConverter.convert(message, newHost, this.logger);
            if (convertedStr === null) {
                this.logger.info("No Twitter URLs found, ignoring.");
                return null;
            }

            const hostSelect = new StringSelectMenuBuilder()
                .setCustomId(TwitterEmbedBot.STRING_SELECT_CUSTOM_ID)
                .setPlaceholder("Switch host");
            this.config.replacementDomains.forEach((domain) => {
                hostSelect.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(domain)
                        .setValue(domain)
                        .setDefault(domain === newHost)
                );
            });
            const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hostSelect);

            return {
                content: convertedStr,
                components: [selectRow]
            };
        } catch (error) {
            this.logger.error(`Ran into error in handleMessage(), ignoring:\n${error}`);
            return null;
        }
    }

    private static createProgressEmbed(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0xFFFFFF);
    }

    private static createErrorEmbed(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0xFF0000);
    }

    getIntents(): GatewayIntentBits[] {
        return this.intents;
    }

    getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[] {
        return this.commands;
    }
}
