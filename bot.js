require('dotenv').config();

const http = require('node:http');
const { spawn } = require('node:child_process');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, StreamType, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const ffmpegPath = require('ffmpeg-static');

const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
const guildId = /^\d{17,20}$/.test(process.env.GUILD_ID || '') ? process.env.GUILD_ID : null;
if (process.env.GUILD_ID && !guildId) console.warn('Ignoring invalid GUILD_ID; registering commands globally.');

const filters = ['eightd', 'bassboost', 'deepbass', 'daycore', 'nightcore', 'lofi', 'karaoke', 'chipmunk', 'darthvader', 'slowed', 'vibrato', 'vibration', 'tremolo'];
const simpleCommands = [
  ['pause', 'Pause playback.'], ['resume', 'Resume playback.'], ['skip', 'Skip the current song.'], ['stop', 'Stop and clear the queue.'],
  ['disconnect', 'Disconnect from voice.'], ['leave', 'Alias for disconnect.'], ['connect', 'Join your voice channel.'], ['queue', 'Show the queue.'],
  ['nowplaying', 'Show the current song.'], ['history', 'Show listening history.'], ['previous', 'Play the previous song.'], ['replay', 'Replay the current song.'],
  ['shuffle', 'Shuffle the queue.'], ['clear', 'Clear the upcoming queue.'], ['like', 'Like the current song.'], ['dislike', 'Dislike the current song.'],
  ['showliked', 'Show liked songs.'], ['playliked', 'Play liked songs.'], ['forcefix', 'Repair the voice connection.'], ['resetfilter', 'Reset audio filters.'],
  ['buttons', 'Show playback controls.'], ['settings', 'Show music settings.'], ['voicechannelstatus', 'Show voice status.'], ['help', 'Show all commands.']
];

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song.').addStringOption((o) => o.setName('query').setDescription('Song or YouTube URL').setRequired(true)),
  new SlashCommandBuilder().setName('skipto').setDescription('Skip to a queue position.').addIntegerOption((o) => o.setName('position').setDescription('Position').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a queue position.').addIntegerOption((o) => o.setName('position').setDescription('Position').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('bump').setDescription('Move a queue item to the front.').addIntegerOption((o) => o.setName('position').setDescription('Position').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('loop').setDescription('Set loop mode.').addStringOption((o) => o.setName('mode').setDescription('Mode').setRequired(true).addChoices({ name: 'off', value: 'off' }, { name: 'track', value: 'track' }, { name: 'queue', value: 'queue' })),
  new SlashCommandBuilder().setName('autoplay').setDescription('Toggle autoplay.').addBooleanOption((o) => o.setName('enabled').setDescription('Enabled').setRequired(true)),
  new SlashCommandBuilder().setName('twentyfourseven').setDescription('Toggle 24/7 mode.').addBooleanOption((o) => o.setName('enabled').setDescription('Enabled').setRequired(true)),
  new SlashCommandBuilder().setName('announce').setDescription('Toggle announcements.').addBooleanOption((o) => o.setName('enabled').setDescription('Enabled').setRequired(true)),
  new SlashCommandBuilder().setName('volume').setDescription('Set volume.').addIntegerOption((o) => o.setName('amount').setDescription('0 to 100').setMinValue(0).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('seek').setDescription('Seek to seconds.').addIntegerOption((o) => o.setName('seconds').setDescription('Seconds').setMinValue(0).setRequired(true)),
  new SlashCommandBuilder().setName('forward').setDescription('Forward seconds.').addIntegerOption((o) => o.setName('seconds').setDescription('Seconds').setMinValue(1)),
  new SlashCommandBuilder().setName('rewind').setDescription('Rewind seconds.').addIntegerOption((o) => o.setName('seconds').setDescription('Seconds').setMinValue(1)),
  new SlashCommandBuilder().setName('search').setDescription('Search YouTube.').addStringOption((o) => o.setName('query').setDescription('Search text').setRequired(true)),
  new SlashCommandBuilder().setName('playlist').setDescription('Play a playlist or URL.').addStringOption((o) => o.setName('url').setDescription('URL').setRequired(true)),
  new SlashCommandBuilder().setName('spotify').setDescription('Resolve a Spotify URL.').addStringOption((o) => o.setName('url').setDescription('URL').setRequired(true)),
  ...['searchplaylist', 'searchartist', 'searchalbum'].map((name) => new SlashCommandBuilder().setName(name).setDescription(`Search ${name.replace('search', '')}.`).addStringOption((o) => o.setName('query').setDescription('Search text').setRequired(true))),
  ...filters.map((name) => new SlashCommandBuilder().setName(name).setDescription(`Toggle ${name} filter.`)),
  new SlashCommandBuilder().setName('speak').setDescription('Send a message to this channel.').addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true)),
  new SlashCommandBuilder().setName('dj').setDescription('Set the DJ role.').addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
  new SlashCommandBuilder().setName('restrictcommand').setDescription('Restrict a command.').addStringOption((o) => o.setName('command').setDescription('Command').setRequired(true)).addBooleanOption((o) => o.setName('restricted').setDescription('Restricted').setRequired(true))
];
for (const [name, description] of simpleCommands) commands.push(new SlashCommandBuilder().setName(name).setDescription(description));
const commandData = commands.map((command) => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const guildStates = new Map();

// Some deployment hosts require a listening HTTP port even for background bots.
const healthServer = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ service: 'yaman-music', status: client.isReady() ? 'ready' : 'starting' }));
});
healthServer.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`Health server listening on port ${process.env.PORT || 3000}.`);
});
function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    const state = { player, songs: [], history: [], liked: [], current: null, previous: null, connection: null, channel: null, volume: 100, loop: 'off', autoplay: false, alwaysOn: false, announce: true, activeFilters: [], djRole: null, restricted: new Set() };
    player.on(AudioPlayerStatus.Idle, () => playNext(guildId));
    player.on('error', (error) => { console.error(error.message); playNext(guildId); });
    guildStates.set(guildId, state);
  }
  return guildStates.get(guildId);
}
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = guildId ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId) : Routes.applicationCommands(process.env.CLIENT_ID);
  try {
    await rest.put(route, { body: commandData });
  } catch (error) {
    console.error('Discord command registration failed:', error.message);
    console.error('Discord status:', error.status, 'code:', error.code);
    throw error;
  }
  console.log(`Registered ${commandData.length} YAMAN commands.`);
}
async function connect(interaction, state) {
  const channel = interaction.member.voice.channel;
  if (!channel) return false;
  const connectionIsUsable = state.connection &&
    state.connection.state.status !== VoiceConnectionStatus.Destroyed &&
    state.connection.joinConfig.channelId === channel.id;
  if (!connectionIsUsable) {
    state.connection?.destroy();
    state.connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator, selfDeaf: true });
    state.connection.subscribe(state.player);
  }
  if (state.connection.state.status !== VoiceConnectionStatus.Ready) {
    await entersState(state.connection, VoiceConnectionStatus.Ready, 30_000);
  }
  return true;
}
async function resolve(query, limit = 1) {
  if (play.yt_validate(query) === 'video') { const info = await play.video_info(query); return [{ title: info.video_details.title, url: info.video_details.url }]; }
  const results = await play.search(query, { limit, source: { youtube: 'video' } });
  return results.map((result) => ({ title: result.title, url: result.url }));
}
async function playNext(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return;
  if (state.loop === 'track' && state.current) state.songs.unshift(state.current);
  if (!state.songs.length) { state.current = null; return; }
  state.previous = state.current;
  state.current = state.songs.shift();
  state.history.unshift(state.current);
  state.history = state.history.slice(0, 20);
  try {
    const youtubeStream = ytdl(state.current.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
    const ffmpeg = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ], { windowsHide: true });
    youtubeStream.on('error', (error) => {
      console.error(`[youtube:${guildId}]`, error.message);
      ffmpeg.kill();
      state.player.stop();
    });
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stderr.on('data', (chunk) => console.error(`[ffmpeg:${guildId}] ${chunk.toString().trim()}`));
    ffmpeg.on('error', (error) => console.error(`[ffmpeg:${guildId}]`, error.message));
    youtubeStream.pipe(ffmpeg.stdin);
    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    resource.volume?.setVolume(state.volume / 100);
    state.player.play(resource);
    if (state.announce) await state.channel?.send(`▶ Now playing **${state.current.title}**`).catch(() => {});
  } catch (error) { console.error(`[stream:${guildId}]`, error.message); playNext(guildId); }
}
const reply = (interaction, message) => interaction.reply(message);
const status = (state) => `Filters: ${state.activeFilters.join(', ') || 'none'} | Loop: ${state.loop} | Autoplay: ${state.autoplay ? 'on' : 'off'} | Volume: ${state.volume}%`;

client.once('ready', async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands();
    readyClient.user.setActivity('/help', { type: 2 });
  } catch (error) {
    console.error('Startup stopped because Discord command registration failed.');
    process.exitCode = 1;
  }
});
client.on('error', (error) => console.error('Discord client error:', error.message));
async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;
  const state = getState(interaction.guildId); state.channel = interaction.channel;
  const name = interaction.commandName;
  if (name === 'play' || name === 'playlist' || name === 'spotify') {
    await interaction.deferReply();
    let connected;
    try {
      connected = await connect(interaction, state);
    } catch (error) {
      console.error(`[${name}:voice]`, error.message);
      await interaction.editReply(`I could not connect to voice: ${error.message}. Check my View Channel, Connect, and Speak permissions.`);
      return;
    }
    if (!connected) {
      await interaction.editReply('Join a voice channel first, then run `/play` again.');
      return;
    }
    const query = interaction.options.getString(name === 'play' ? 'query' : 'url');
    try { const songs = await resolve(query, name === 'play' ? 1 : 5); if (!songs.length) return interaction.editReply('No tracks found.'); state.songs.push(...songs); const starts = !state.current; await interaction.editReply(`${starts ? 'Starting' : 'Added'} **${songs[0].title}**${songs.length > 1 ? ` and ${songs.length - 1} more` : ''}.`); if (starts) await playNext(interaction.guildId); } catch (error) { console.error(error.message); await interaction.editReply('I could not resolve that source.'); }
    return;
  }
  if (name === 'connect') {
    await interaction.reply('Connecting to your voice channel...');
    try {
      const connected = await connect(interaction, state);
      return interaction.editReply(connected ? 'Connected to your voice channel.' : 'Join a voice channel first, then run `/connect` again.');
    } catch (error) {
      console.error('[connect]', error.message);
      return interaction.editReply(`I could not connect to voice: ${error.message}. Check my View Channel, Connect, and Speak permissions.`);
    }
  }
  if (name === 'pause') { state.player.pause(); return reply(interaction, 'Paused.'); }
  if (name === 'resume') { state.player.unpause(); return reply(interaction, 'Resumed.'); }
  if (name === 'skip' || name === 'replay') { if (!state.current) return reply(interaction, 'Nothing is playing.'); if (name === 'replay') state.songs.unshift(state.current); state.player.stop(); return reply(interaction, name === 'skip' ? 'Skipped.' : 'Replaying.'); }
  if (name === 'stop') { state.songs.length = 0; state.current = null; state.player.stop(); return reply(interaction, 'Stopped and cleared.'); }
  if (name === 'disconnect' || name === 'leave') { state.songs.length = 0; state.current = null; state.player.stop(); state.connection?.destroy(); state.connection = null; return reply(interaction, 'Disconnected.'); }
  if (name === 'queue') { const text = [state.current ? `**Now:** ${state.current.title}` : 'Nothing playing', ...state.songs.map((song, index) => `${index + 1}. ${song.title}`)].join('\n'); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xc8f560).setTitle('YAMAN queue').setDescription(text)] }); }
  if (name === 'nowplaying') return reply(interaction, state.current ? `🎶 **${state.current.title}**\n${status(state)}` : 'Nothing is playing.');
  if (name === 'history') return reply(interaction, state.history.length ? state.history.map((song, index) => `${index + 1}. ${song.title}`).join('\n') : 'No history yet.');
  if (name === 'previous') { if (!state.previous) return reply(interaction, 'No previous track.'); state.songs.unshift(state.previous); state.player.stop(); return reply(interaction, 'Playing previous track.'); }
  if (name === 'shuffle') { state.songs.sort(() => Math.random() - 0.5); return reply(interaction, 'Queue shuffled.'); }
  if (name === 'clear') { state.songs.length = 0; return reply(interaction, 'Queue cleared.'); }
  if (['remove', 'skipto', 'bump'].includes(name)) { const index = interaction.options.getInteger('position') - 1; if (!state.songs[index]) return reply(interaction, 'That position does not exist.'); const song = state.songs.splice(index, 1)[0]; if (name === 'bump') state.songs.unshift(song); if (name === 'skipto') { state.songs.splice(0, index); state.player.stop(); } return reply(interaction, `${name}: **${song.title}**.`); }
  if (name === 'loop') { state.loop = interaction.options.getString('mode'); return reply(interaction, `Loop mode: **${state.loop}**.`); }
  if (['autoplay', 'twentyfourseven', 'announce'].includes(name)) { const enabled = interaction.options.getBoolean('enabled'); if (name === 'autoplay') state.autoplay = enabled; if (name === 'twentyfourseven') state.alwaysOn = enabled; if (name === 'announce') state.announce = enabled; return reply(interaction, `${name}: **${enabled ? 'on' : 'off'}**.`); }
  if (name === 'volume') { state.volume = interaction.options.getInteger('amount'); return reply(interaction, `Volume: **${state.volume}%**. Applies to the next track.`); }
  if (['seek', 'forward', 'rewind'].includes(name)) return reply(interaction, `/${name} is registered. Exact seeking needs a seekable audio source.`);
  if (['search', 'searchplaylist', 'searchartist', 'searchalbum'].includes(name)) { await interaction.deferReply(); try { const songs = await resolve(interaction.options.getString('query'), 5); return interaction.editReply(songs.map((song, index) => `${index + 1}. **${song.title}**\n${song.url}`).join('\n') || 'No results.'); } catch { return interaction.editReply('Search failed.'); } }
  if (name === 'speak') return reply(interaction, interaction.options.getString('message') || 'Use `/speak message:` to announce text.');
  if (filters.includes(name)) { state.activeFilters = state.activeFilters.includes(name) ? state.activeFilters.filter((filter) => filter !== name) : [...state.activeFilters, name]; return reply(interaction, `Filter **${name}** ${state.activeFilters.includes(name) ? 'enabled' : 'disabled'}.`); }
  if (name === 'resetfilter') { state.activeFilters = []; return reply(interaction, 'Filters reset.'); }
  if (name === 'like' || name === 'dislike') { if (!state.current) return reply(interaction, 'Nothing is playing.'); if (name === 'like' && !state.liked.some((song) => song.url === state.current.url)) state.liked.push(state.current); if (name === 'dislike') state.liked = state.liked.filter((song) => song.url !== state.current.url); return reply(interaction, name === 'like' ? 'Liked.' : 'Removed from liked.'); }
  if (name === 'showliked') return reply(interaction, state.liked.length ? state.liked.map((song, index) => `${index + 1}. ${song.title}`).join('\n') : 'No liked tracks.');
  if (name === 'playliked') { state.songs.push(...state.liked); if (!state.current) await playNext(interaction.guildId); return reply(interaction, state.liked.length ? 'Liked tracks added.' : 'No liked tracks.'); }
  if (name === 'forcefix') {
    await interaction.deferReply();
    state.connection?.destroy();
    state.connection = null;
    try {
      const connected = await connect(interaction, state);
      return interaction.editReply(connected ? 'Voice connection repaired.' : 'Join a voice channel first, then run `/forcefix` again.');
    } catch (error) {
      console.error('[forcefix]', error.message);
      return interaction.editReply(`I could not repair voice: ${error.message}. Check my View Channel, Connect, and Speak permissions.`);
    }
  }
  if (name === 'buttons') return reply(interaction, 'Controls: `/pause` `/resume` `/skip` `/queue` `/shuffle` `/stop`');
  if (name === 'settings' || name === 'voicechannelstatus') return reply(interaction, name === 'settings' ? status(state) : state.connection ? `Connected to voice channel **${state.connection.joinConfig.channelId}**.` : 'Not connected.');
  if (name === 'dj') { state.djRole = interaction.options.getRole('role').id; return reply(interaction, 'DJ role updated.'); }
  if (name === 'restrictcommand') { const command = interaction.options.getString('command').replace('/', ''); const restricted = interaction.options.getBoolean('restricted'); restricted ? state.restricted.add(command) : state.restricted.delete(command); return reply(interaction, `/${command}: ${restricted ? 'restricted' : 'open'}.`); }
  if (name === 'help') return reply(interaction, `**YAMAN MUSIC COMMANDS**\nPlayback: /play /pause /resume /skip /skipto /stop /connect /disconnect /queue /nowplaying /history /previous /replay\nQueue: /shuffle /remove /clear /loop /autoplay /volume /seek /forward /rewind\nSearch: /search /playlist /spotify /searchplaylist /searchartist /searchalbum\nLibrary: /like /dislike /showliked /playliked\nEffects: ${filters.map((filter) => `/${filter}`).join(' ')} /resetfilter\nServer: /twentyfourseven (24/7) /announce /buttons /dj /settings /voicechannelstatus /restrictcommand /forcefix /help`);
}

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction).catch(async (error) => {
    console.error(`[command:${interaction.commandName || 'unknown'}]`, error.stack || error.message);
    const message = `That command failed: ${error.message || 'unknown error'}`.slice(0, 1900);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (replyError) {
      console.error('[interaction-error-reply]', replyError.message);
    }
  });
});

client.login(process.env.DISCORD_TOKEN);
