const { WebSocketServer } = require('./websocket');
const { setupCLI } = require('./cli');
const { loadConfig } = require('./config');
const AutoLaunch = require('auto-launch');
const net = require('net');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { program } = require('commander');

class DiscordRPC extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.socket = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.currentActivity = null;
  }

  connect() {
    if (this.socket) return;

    const ipcPath =
      os.platform() === 'win32'
        ? '\\\\?\\pipe\\discord-ipc-0'
        : path.join(
            process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp',
            'discord-ipc-0'
          );

    this.socket = net.createConnection(ipcPath, () => {
      this.write(0, { v: 1, client_id: this.clientId });
    });

    this.socket.on('data', (data) => this.handleMessage(data));
    this.socket.on('close', () => this.handleDisconnect());
    this.socket.on('error', (err) => {
      console.error('[Discord] Connection error:', err.message);
      this.handleDisconnect();
    });
  }

  handleMessage(data) {
    try {
      const payload = JSON.parse(data.slice(8));

      if (payload.cmd === 'DISPATCH' && payload.evt === 'READY') {
        this.connected = true;
        console.log('[Discord] Connected successfully');
        if (this.currentActivity) this.setActivity(this.currentActivity);
      }
    } catch (err) {
      console.error('[Discord] Failed to parse message:', err.message);
    }
  }

  handleDisconnect() {
    this.connected = false;
    this.socket = null;
    console.log('[Discord] Disconnected, attempting reconnect in 5s...');

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  write(op, payload) {
    if (!this.socket) return;

    const data = Buffer.from(JSON.stringify(payload));
    const packet = Buffer.alloc(8 + data.length);
    packet.writeInt32LE(op, 0);
    packet.writeInt32LE(data.length, 4);
    data.copy(packet, 8);

    this.socket.write(packet);
  }

  setActivity(metadata) {
    this.currentActivity = metadata;
    if (!this.connected) return;

    console.log('[Discord] Setting activity:', {
      state: metadata.paused,
      currentTime: metadata.currentTime,
      duration: metadata.duration,
      timestamp: new Date().toISOString(),
    });

    const activity = {
      details: metadata.title || 'Listening to SoundCloud',
      state: metadata.artist || 'Unknown Artist',
      assets: {
        large_image: metadata.artwork || 'soundcloud_logo',
        large_text: metadata.title || 'SoundCloud',
        small_image: metadata.paused === 'playing' ? 'play_icon' : 'pause_icon',
        small_text: metadata.paused === 'playing' ? 'Playing' : 'Paused',
      },
      // This timestamp logic automatically handles pausing and resuming
      timestamps:
        metadata.paused === 'playing'
          ? {
              start: Date.now() - metadata.currentTime * 1000,
              end:
                Date.now() + (metadata.duration - metadata.currentTime) * 1000,
            }
          : undefined,
      buttons: [
        {
          label: 'Listen on SoundCloud',
          url: 'https://soundcloud.com',
        },
      ],
      type: 2,
    };

    this.write(1, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: Math.random().toString(),
    });
  }
}

class SRPCServer {
  constructor() {
    this.logHandlers = new Set();
    this.autoStart = true;
    this.logLevel = 'info';
    this.discord = null;
    this.wss = null;
  }

  async start() {
    try {
      this.log('info', 'Starting SoundCloud RPC server...');

      const config = await loadConfig();
      this.log('info', `WebSocket server will listen on port ${config.port}`);

      // Initialize Discord RPC
      this.discord = new DiscordRPC(config.discordClientId);
      this.discord.connect();

      // Initialize WebSocket server
      this.wss = new WebSocketServer(config.port, config.token);

      this.wss.onMetadataUpdate = (metadata) => {
        if (!metadata?.title || !metadata?.artist) {
          this.log('warn', 'Incomplete metadata received');
          return;
        }

        this.log(
          'info',
          `Updating presence: ${metadata.title} - ${metadata.artist}`
        );
        this.discord.setActivity(metadata);
      };

      this.wss.onClientDisconnect = () => {
        this.log('info', 'WebSocket client disconnected, clearing presence');
        this.discord.write(1, {
          cmd: 'SET_ACTIVITY',
          args: { pid: process.pid },
          nonce: Math.random().toString(),
        });
      };

      this.wss.start();
      this.log('info', 'Server started successfully');
    } catch (error) {
      this.log('error', `Failed to start server: ${error.message}`);
      throw error;
    }
  }

  stop() {
    this.log('info', 'Stopping SoundCloud RPC server...');
    if (this.wss) {
      this.wss.stop();
    }
    process.exit();
  }

  log(level, message) {
    if (this.shouldLog(level)) {
      console.log(`[SRPC] ${level.toUpperCase()}: ${message}`);
      this.logHandlers.forEach((handler) => handler(level, message));
    }
  }

  shouldLog(level) {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  setLogLevel(level) {
    this.logLevel = level;
    this.log('info', `Log level set to ${level}`);
  }

  setAutoStart(enabled) {
    this.autoStart = enabled;
    autoLauncher.isEnabled().then((isEnabled) => {
      if (enabled && !isEnabled) {
        autoLauncher.enable();
        this.log('info', 'Auto-start enabled');
      } else if (!enabled && isEnabled) {
        autoLauncher.disable();
        this.log('info', 'Auto-start disabled');
      }
    });
  }

  addLogHandler(handler) {
    this.logHandlers.add(handler);
  }

  removeLogHandler(handler) {
    this.logHandlers.delete(handler);
  }
}

async function main() {
  const server = new SRPCServer();

  const isPkg = typeof process.pkg !== 'undefined';
  const basePath = isPkg ? path.dirname(process.execPath) : __dirname;

  // Setup auto-launch
  const autoLauncher = new AutoLaunch({
    name: 'SoundCloud RPC',
    path: isPkg ? process.execPath : process.argv[0],
    args: isPkg ? [] : [process.argv[1]],
  });

  autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) autoLauncher.enable();
  });

  // Handle cleanup
  process.on('SIGINT', () => {
    server.log('info', 'Shutting down...');
    if (server.wss) server.wss.stop();
    process.exit();
  });

  setupCLI(server);
  return server;
}

// Start the actual RPC server if this is the main execution
if (require.main === module) {
  main()
    .then((server) => {
      if (process.argv.length === 2) {
        server.start();
      } else {
        program
          .command('start')
          .description('Start the RPC server')
          .action(() => server.start());

        program.parse(process.argv);
      }
    })
    .catch(console.error);
}
