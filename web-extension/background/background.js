let ws = null;
let wsConnected = false;
let connectionConfig = { port: 8173, token: 'secure-token' };
let reconnectTimeout = null;

function connectWebSocket() {
  if (ws) {
    ws.close();
    clearTimeout(reconnectTimeout);
  }

  try {
    ws = new WebSocket(`ws://localhost:${connectionConfig.port}`);
    console.log(`[SRPC] Connecting to ws://localhost:${connectionConfig.port}`);

    ws.onopen = () => {
      console.log('[SRPC] Connected, sending auth');
      ws.send(
        JSON.stringify({
          type: 'auth',
          token: connectionConfig.token,
          metadata: { client: 'srpc-extension' },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'AUTH_SUCCESS') {
          console.log('[SRPC] Authentication successful');
          wsConnected = true;
          broadcastStatus();

          // Start periodic ping to keep connection alive
          setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        }
      } catch (e) {
        console.error('[SRPC] Message parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[SRPC] Connection closed');
      wsConnected = false;
      broadcastStatus();
      reconnectTimeout = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
      console.error('[SRPC] WebSocket error:', error);
      wsConnected = false;
      broadcastStatus();
    };
  } catch (e) {
    console.error('[SRPC] Connection error:', e);
    reconnectTimeout = setTimeout(connectWebSocket, 5000);
  }
}

function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: 'WS_STATUS_CHANGED',
    connected: wsConnected,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_WS_STATUS') {
    sendResponse(wsConnected);
    return true;
  }

  if (message.type === 'METADATA_UPDATE' && ws && wsConnected) {
    ws.send(
      JSON.stringify({
        type: 'metadata',
        ...message.metadata,
      })
    );
  }

  if (message.type === 'SETTINGS_UPDATED') {
    chrome.storage.local.get(['port', 'token'], (config) => {
      connectionConfig = config;
      connectWebSocket();
    });
  }
});

// Initial connection
chrome.storage.local.get(['port', 'token'], (config) => {
  if (config.port) connectionConfig = config;
  connectWebSocket();
});
