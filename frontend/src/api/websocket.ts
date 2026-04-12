/**
 * WebSocket Client for Real-Time Job Progress Tracking
 * Handles WebSocket connections for background job updates
 */

class WebSocketClient {
  baseUrl: string;
  connections: Map<string, WebSocket>;
  reconnectAttempts: Map<string, number>;
  maxReconnectAttempts: number;
  reconnectDelay: number;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 seconds
  }

  /**
   * Connect to job progress WebSocket
   * @param {string} jobId - Job ID to track
   * @param {Object} callbacks - Event callbacks
   * @returns {WebSocket} WebSocket instance
   */
  connectToJob(jobId: string, callbacks: any = {}) {
    const wsUrl = `${this.baseUrl}/ws/jobs/${jobId}`;

    // Close existing connection if any
    if (this.connections.has(jobId)) {
      this.disconnect(jobId);
    }

    const ws = new WebSocket(wsUrl);
    this.connections.set(jobId, ws);
    this.reconnectAttempts.set(jobId, 0);

    // Message handler
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[WS] Job ${jobId} update:`, data);

        // Call appropriate callback based on message type
        if (data.status === 'PROGRESS' && callbacks.onProgress) {
          callbacks.onProgress(data);
        } else if (data.status === 'SUCCESS' && callbacks.onSuccess) {
          callbacks.onSuccess(data);
        } else if (data.status === 'FAILURE' && callbacks.onError) {
          callbacks.onError(data);
        }

        // Always call onUpdate if provided
        if (callbacks.onUpdate) {
          callbacks.onUpdate(data);
        }

        // Auto-disconnect on completion
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          setTimeout(() => this.disconnect(jobId), 2000);
        }
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    // Connection opened
    ws.onopen = () => {
      console.log(`[WS] Connected to job ${jobId}`);
      this.reconnectAttempts.set(jobId, 0);

      if (callbacks.onConnect) {
        callbacks.onConnect();
      }
    };

    // Connection closed
    ws.onclose = (event) => {
      console.log(`[WS] Disconnected from job ${jobId}`, event.code, event.reason);

      if (callbacks.onDisconnect) {
        callbacks.onDisconnect(event);
      }

      // Attempt reconnection if not intentional disconnect
      if (!event.wasClean && this.shouldReconnect(jobId)) {
        this.scheduleReconnect(jobId, callbacks);
      }

      this.connections.delete(jobId);
    };

    // Error handler
    ws.onerror = (error) => {
      console.error(`[WS] Connection error for job ${jobId}:`, error);

      if (callbacks.onError) {
        callbacks.onError({ error: 'WebSocket connection error', details: error });
      }
    };

    return ws;
  }

  /**
   * Check if should attempt reconnection
   * @param {string} jobId - Job ID
   * @returns {boolean} Should reconnect
   */
  shouldReconnect(jobId) {
    const attempts = this.reconnectAttempts.get(jobId) || 0;
    return attempts < this.maxReconnectAttempts;
  }

  /**
   * Schedule reconnection attempt
   * @param {string} jobId - Job ID
   * @param {Object} callbacks - Event callbacks
   */
  scheduleReconnect(jobId, callbacks) {
    const attempts = this.reconnectAttempts.get(jobId) || 0;
    const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff

    console.log(
      `[WS] Scheduling reconnect attempt ${attempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (this.shouldReconnect(jobId)) {
        this.reconnectAttempts.set(jobId, attempts + 1);
        this.connectToJob(jobId, callbacks);
      }
    }, delay);
  }

  /**
   * Disconnect from job WebSocket
   * @param {string} jobId - Job ID
   */
  disconnect(jobId: string) {
    const ws = this.connections.get(jobId);
    if (ws) {
      ws.close(1000, 'Client disconnect');
      this.connections.delete(jobId);
      this.reconnectAttempts.delete(jobId);
      console.log(`[WS] Closed connection to job ${jobId}`);
    }
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnectAll() {
    console.log(`[WS] Closing all connections`);
    this.connections.forEach((ws, jobId) => {
      this.disconnect(jobId);
    });
  }

  /**
   * Check if connected to a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Is connected
   */
  isConnected(jobId) {
    const ws = this.connections.get(jobId);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   * @param {string} jobId - Job ID
   * @returns {string} Connection state
   */
  getConnectionState(jobId) {
    const ws = this.connections.get(jobId);
    if (!ws) return 'CLOSED';

    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Get all active connections
   * @returns {Array} Array of job IDs with active connections
   */
  getActiveConnections() {
    return Array.from(this.connections.keys());
  }
}

// Create singleton instance
const wsClient = new WebSocketClient();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    wsClient.disconnectAll();
  });
}

export default wsClient;