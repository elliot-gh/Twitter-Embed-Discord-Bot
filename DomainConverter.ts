import { Message } from "discord.js";
import winston from "winston";

const TWITTER_REGEX =
    /(?:(?:https:\/\/twitter\.com)|(?:https:\/\/mobile\.twitter\.com)|(?:http:\/\/twitter\.com)|(?:http:\/\/mobile\.twitter\.com))(?:\/.+)(?:\/status\/)(?:[0-9]+)/g;

export class DomainConverter {
    public static async convert(message: Message, newHost: string, logger: winston.Logger): Promise<string | null> {
        const content = message.content.trim();
        const twitterMatches = content.matchAll(TWITTER_REGEX);
        const newUrls = [];
        for (const match of twitterMatches) {
            const urlStr = match[0];
            logger.info(`Found Twitter URL: ${urlStr}`);
            const url = new URL(urlStr);
            url.hash = "";
            url.search = "";
            url.host = newHost;
            logger.info(`New URL: ${url.toString()}`);
            newUrls.push(url.toString());
        }

        if (newUrls.length === 0) {
            return null;
        }

        let newStr = "";
        for (const newUrl of newUrls) {
            newStr += `${newUrl}\n`;
        }

        return newStr;
    }
}
