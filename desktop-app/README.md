# SoundCloud RPC Desktop App

A lightweight desktop application that enables Discord Rich Presence integration for SoundCloud, displaying your currently playing track information in your Discord status.

## Features

- Real-time SoundCloud playback status on Discord
- Secure WebSocket server for browser extension communication
- Automatic startup option
- Cross-platform support (Windows & Linux)
- Token-based authentication for secure communication

## Getting Started

1. Download the latest release for your platform
2. Run the application
3. Install the browser extension
4. Enjoy your SoundCloud activity on Discord!

## Requirements

- Discord desktop app
- Chrome, Firefox, or Edge browser
- SoundCloud RPC browser extension

## Building from Source

```bash
# Install dependencies
pnpm install

# Start the application
pnpm start

# Build executables
pnpm run build:all
```

## Configuration

The app will automatically prompt for required configuration on first run. You can also manually edit `config.json`:

```json
{
  "port": 8173,
  "token": "your-secure-token",
  "discordClientId": "your-discord-client-id"
}
```
