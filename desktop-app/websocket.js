const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WebSocketServer {
  constructor(port, token) {
    this.port = port;
    this.token = token;
    this.wss = null;
    this.clients = new Map();
    this.onMetadataUpdate = null;
    this.onClientDisconnect = null;
  }

  start() {
    if (this.wss) {
      this.stop();
    }

    console.log(`[WebSocket] Starting server on port ${this.port}`);
    this.wss = new WebSocket.Server({
      port: this.port,
      clientTracking: true,
    });

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] New client connected');
      const clientId = uuidv4();
      ws.clientId = clientId;
      ws.isAuthenticated = false;

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('[WebSocket] Received message:', data);

          if (data.type === 'auth') {
            if (data.token === this.token) {
              ws.isAuthenticated = true;
              this.clients.set(clientId, ws);
              console.log('[WebSocket] Client authenticated');
              ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
            } else {
              console.log('[WebSocket] Auth failed - invalid token');
              ws.send(JSON.stringify({ type: 'AUTH_FAILED' }));
              ws.close();
            }
            return;
          }

          if (!ws.isAuthenticated) {
            console.log('[WebSocket] Unauthorized message');
            ws.send(
              JSON.stringify({ type: 'ERROR', message: 'Not authenticated' })
            );
            return;
          }

          if (data.type === 'METADATA_UPDATE' && this.onMetadataUpdate) {
            console.log('[WebSocket] Updating metadata:', data.data);
            this.onMetadataUpdate(data.data);
          }
        } catch (error) {
          console.error('[WebSocket] Error handling message:', error);
        }
      });

      // Ping/pong to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(clientId);
        clearInterval(pingInterval);
        if (this.onClientDisconnect && this.clients.size === 0) {
          this.onClientDisconnect();
        }
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error);
        this.clients.delete(clientId);
        clearInterval(pingInterval);
        if (this.onClientDisconnect && this.clients.size === 0) {
          this.onClientDisconnect();
        }
      });
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });
  }

  stop() {
    if (this.wss) {
      console.log('[WebSocket] Stopping server');
      for (const client of this.clients.values()) {
        client.close();
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }

  broadcast(message) {
    for (const client of this.clients.values()) {
      if (client.isAuthenticated && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
}

module.exports = { WebSocketServer };
