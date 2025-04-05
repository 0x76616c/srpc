const elements = {
  artwork: document.getElementById('artwork'),
  title: document.getElementById('title'),
  artist: document.getElementById('artist'),
  currentTime: document.getElementById('currentTime'),
  duration: document.getElementById('duration'),
  barFill: document.getElementById('barFill'),
  open: document.getElementById('open'),
  status: document.getElementById('status'),
};

let lastMetadata = null;
let lastFetchTime = 0;
let interval = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function updateStaticTrackInfo(data) {
  elements.title.textContent = data.title;
  elements.artist.textContent = data.artist;
  elements.artwork.src = data.artwork || '';
  elements.duration.textContent = formatTime(data.duration || 0);
}

function updatePlaybackStatus(paused) {
  const playbackEl = document.getElementById('playback-status');

  if (paused === 'paused') {
    playbackEl.textContent = '⏸️ Paused';
    playbackEl.style.color = '#faa61a';
  } else {
    playbackEl.textContent = '▶️ Playing';
    playbackEl.style.color = '#43b581';
  }
}

function updatePopupLive() {
  chrome.tabs.query({ url: '*://soundcloud.com/*' }, (tabs) => {
    if (!tabs.length) return;

    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(tabId, { type: 'GET_METADATA_LIVE' }, (data) => {
      if (!data) return;

      const now = Date.now();
      const isNewTrack = data.title !== lastMetadata?.title;

      lastMetadata = data;
      lastFetchTime = now;

      if (isNewTrack) {
        updateStaticTrackInfo(data);
      }

      updatePlaybackStatus(data.paused);
    });
  });
}

function startProgressUpdater() {
  clearInterval(interval);
  updatePopupLive(); // Initial fetch

  interval = setInterval(() => {
    updatePopupLive(); // Keep syncing metadata

    if (!lastMetadata) return;

    const elapsed = (Date.now() - lastFetchTime) / 1000;
    const isPlaying = lastMetadata.paused === 'playing';
    const current = isPlaying
      ? lastMetadata.currentTime + elapsed
      : lastMetadata.currentTime;

    const duration = lastMetadata.duration || 1;

    elements.currentTime.textContent = formatTime(Math.min(current, duration));
    elements.barFill.style.width = `${Math.min((current / duration) * 100, 100)}%`;
  }, 1000);
}

elements.open.onclick = () => {
  chrome.tabs.query({ url: '*://soundcloud.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      // Focus the first SoundCloud tab
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // If not open, open a new one
      chrome.tabs.create({ url: 'https://soundcloud.com' });
    }
  });
};

const updateWebSocketStatus = (connected) => {
  const wsEl = document.getElementById('ws-status');
  wsEl.textContent = connected ? '🟢 Connected to desktop' : '🔴 Not connected';
  wsEl.style.color = connected ? '#43b581' : '#f04747';
};

const storage = (typeof browser !== 'undefined' ? browser : chrome).storage;

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  storage.local.get(['port', 'token'], (config) => {
    document.getElementById('port').value = config.port || 8173;
    document.getElementById('token').value = config.token || 'secure-token';
  });

  // Save settings handler
  document.getElementById('saveSettings').addEventListener('click', () => {
    const port = parseInt(document.getElementById('port').value);
    const token = document.getElementById('token').value;

    storage.local.set({ port, token }, () => {
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });

      const status = document.getElementById('saveStatus');
      status.textContent = 'Settings saved! Reconnecting...';
      status.style.color = '#43b581';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  // Get initial status and start metadata updates
  chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }, (connected) => {
    if (chrome.runtime.lastError) return;
    updateWebSocketStatus(connected);
  });

  // Listen for status changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'WS_STATUS_CHANGED') {
      updateWebSocketStatus(message.connected);
    }
  });

  // Start metadata updates
  startProgressUpdater();

  // Keep metadata updates running while popup is open
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(interval);
    } else {
      startProgressUpdater();
    }
  });
});
