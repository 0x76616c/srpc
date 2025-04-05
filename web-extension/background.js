const DEFAULT_CONFIG = {
  port: 8173,
  token: 'secure-token',
};

const storage = (typeof browser !== 'undefined' ? browser : chrome).storage;
let latestMetadata = null;
let lastSentMetadataHash = null;

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.config = { ...DEFAULT_CONFIG };
    this.isAuthenticated = false;
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const stored = await new Promise((resolve) =>
        storage.local.get(['port', 'token'], resolve)
      );

      this.config = {
        port: stored.port || DEFAULT_CONFIG.port,
        token: stored.token || DEFAULT_CONFIG.token,
      };

      console.log('[SRPC] Loaded config:', this.config);
      this.connect();
    } catch (err) {
      console.error('[SRPC] Failed to load config:', err);
      this.config = { ...DEFAULT_CONFIG };
      this.connect();
    }
  }

  connect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthenticated = false;
    console.log(`[SRPC] Connecting to ws://localhost:${this.config.port}`);

    try {
      this.ws = new WebSocket(`ws://localhost:${this.config.port}`);

      this.ws.onopen = () => {
        console.log('[SRPC] Connected, sending auth');
        this.ws.send(
          JSON.stringify({
            type: 'auth',
            token: this.config.token,
          })
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SRPC] Received:', data);

          if (data.type === 'AUTH_SUCCESS') {
            console.log('[SRPC] Authentication successful');
            this.isAuthenticated = true;
          } else if (data.type === 'AUTH_FAILED') {
            console.error('[SRPC] Authentication failed');
            this.isAuthenticated = false;
            this.ws.close();
          }
        } catch (error) {
          console.error('[SRPC] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[SRPC] Connection closed');
        this.isAuthenticated = false;
        this.ws = null;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 5000);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[SRPC] Connection error:', error);
        this.isAuthenticated = false;
      };
    } catch (error) {
      console.error('[SRPC] Failed to create WebSocket:', error);
      this.isAuthenticated = false;
    }
  }

  sendMetadata(metadata) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[SRPC] Sending metadata:', metadata);
      this.ws.send(
        JSON.stringify({
          type: 'METADATA_UPDATE',
          data: metadata,
        })
      );
    } else {
      console.warn('[SRPC] Cannot send metadata - connection not ready');
    }
  }
}

const wsClient = new WebSocketClient();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPDATE_METADATA') {
    latestMetadata = msg.metadata;
    const metadataHash = JSON.stringify(latestMetadata);

    if (metadataHash !== lastSentMetadataHash) {
      lastSentMetadataHash = metadataHash;
      wsClient.sendMetadata(latestMetadata);
    }
  } else if (msg.type === 'GET_METADATA') {
    sendResponse(latestMetadata);
  } else if (msg.type === 'GET_WS_STATUS') {
    sendResponse(
      wsClient?.ws?.readyState === WebSocket.OPEN && wsClient.isAuthenticated
    );
    return true;
  } else if (msg.type === 'SETTINGS_UPDATED') {
    wsClient.loadConfig();
  }
  return true;
});
