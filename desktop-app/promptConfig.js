const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

async function promptForConfig(configPath) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log('\nFirst time setup:');
  const clientId = await question('Enter your Discord Application Client ID: ');

  const config = {
    port: 8173,
    token: 'your-token-here',
    discordClientId: clientId,
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  rl.close();
  return config;
}

module.exports = { promptForConfig };
