require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promptForConfig } = require('./promptConfig');

const isPkg = typeof process.pkg !== 'undefined';
const configPath = isPkg
  ? path.join(path.dirname(process.execPath), 'config.json')
  : path.join(__dirname, 'config.json');

const defaultConfig = {
  port: 8173,
  token: 'secure-token',
  discordClientId: '1106789337726935040',
};

async function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      return await promptForConfig(configPath);
    }
    const config = require(configPath);
    if (
      !config.discordClientId ||
      config.discordClientId === 'your-client-id-here'
    ) {
      return await promptForConfig(configPath);
    }
    return config;
  } catch (error) {
    return await promptForConfig(configPath);
  }
}

module.exports = { loadConfig };
