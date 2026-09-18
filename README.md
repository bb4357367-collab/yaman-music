# YAMAN MUSIC

YAMAN is a Discord music bot with an optional browser dashboard. The Discord bot is the main product; the dashboard is a visual control-room concept for a future web control panel.

## Run the Discord bot

1. Install Node.js 20 or newer.
2. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`. Add `GUILD_ID` while testing so commands register immediately in one server.
4. Install dependencies and start the bot:

	```bash
	npm install
	npm start
	```

### Render deployment

Use the `main` branch, build command `npm install`, and start command `npm start`. Add `DISCORD_TOKEN`, `CLIENT_ID`, and a real numeric `GUILD_ID` in Render's Environment settings. Do not copy `.env` to GitHub.

Render free Web Services can sleep when they receive no HTTP traffic. A sleeping service disconnects the Discord bot. For an always-online bot, use a paid Background Worker, or keep this Web Service awake with an external monitor requesting its health URL (`https://your-service.onrender.com/`) every 5 to 10 minutes.

Invite the bot with the `bot` and `applications.commands` scopes and `Connect`, `Speak`, and `Send Messages` permissions. The bot also needs permission to view the voice channel. The bot registers the full requested command set, including playback, queue, history, search, playlists, likes, server settings, and all named filter commands. Use `/help` inside Discord for the grouped list.

Playback, queue, history, search, likes, voice connection, volume, loop, shuffle, and announcements are wired into the runtime. `/seek`, `/forward`, and `/rewind` currently acknowledge the command but need a seekable FFmpeg pipeline for exact seeking. Filter commands persist their selected state and report it; actual DSP processing needs FFmpeg filter wiring. Spotify URLs are accepted as source queries, while dedicated Spotify metadata/API support can be added with Spotify credentials.

## Included

- Responsive music dashboard UI
- Search across the current rotation
- Functional queue and clear queue action
- Play/pause state, progress and volume controls
- Mood cards and recently played tracks
- Discord slash-command bot runtime with voice playback and queue management

The browser UI currently uses demo data and remote cover art. It can be connected to the bot through a small API later. Never commit `.env`; it contains your bot token. The Node bot bundles FFmpeg and the Discord Opus codec, so the deployment should use the repository `npm start` command and should not need a system FFmpeg install.
