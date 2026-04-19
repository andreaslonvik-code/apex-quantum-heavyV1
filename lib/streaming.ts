// ============================================================
// APEX QUANTUM v6.1 - REAL-TIME STREAMING UTILITIES
// WebSocket and SSE streaming for live market data
// ============================================================

import { logger } from './logger';
import { withRetry, StreamingError } from './error-handler';

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  ERROR = 'ERROR',
}

/**
 * Custom WebSocket wrapper with auto-reconnect
 */
export class ApexWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private state: WebSocketState = WebSocketState.CLOSED;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private listeners: Map<string, Set<Function>> = new Map();
  private messageBuffer: string[] = [];
  private maxBufferSize: number = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url: string, maxReconnectAttempts: number = 10) {
    this.url = url;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  /**
   * Connect to WebSocket
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === WebSocketState.OPEN) {
        resolve();
        return;
      }

      try {
        this.state = WebSocketState.CONNECTING;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.state = WebSocketState.OPEN;
          this.reconnectAttempts = 0;

          logger.info('WebSocket connected', { url: this.url });

          // Start heartbeat
          this.startHeartbeat();

          resolve();
          this.emit('connected');
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error: Event) => {
          this.state = WebSocketState.ERROR;
          logger.error('WebSocket error', error as unknown as Error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.state = WebSocketState.CLOSED;
          this.stopHeartbeat();
          logger.info('WebSocket disconnected');

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          } else {
            logger.error('Max reconnect attempts reached');
            this.emit('maxReconnectAttemptsExceeded');
          }
        };
      } catch (error) {
        this.state = WebSocketState.ERROR;
        logger.error('WebSocket connection failed', error as Error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  public async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.state = WebSocketState.CLOSING;
      this.stopHeartbeat();

      if (this.ws) {
        this.ws.onclose = () => {
          resolve();
        };
        this.ws.close();
      } else {
        resolve();
      }

      setTimeout(() => {
        this.state = WebSocketState.CLOSED;
        resolve();
      }, 1000);
    });
  }

  /**
   * Send message to WebSocket
   */
  public send(data: Record<string, unknown> | string): void {
    if (this.state !== WebSocketState.OPEN || !this.ws) {
      throw new StreamingError('WebSocket is not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  /**
   * Subscribe to events
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  public off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Get connection state
   */
  public getState(): WebSocketState {
    return this.state;
  }

  /**
   * Get message buffer
   */
  public getBuffer(): string[] {
    return [...this.messageBuffer];
  }

  // Private methods

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Event handler error', error as Error, { event });
        }
      });
    }
  }

  private handleMessage(data: string): void {
    try {
      // Add to buffer
      this.messageBuffer.push(data);
      if (this.messageBuffer.length > this.maxBufferSize) {
        this.messageBuffer.shift();
      }

      const parsed = JSON.parse(data);
      this.emit('message', parsed);

      // Emit specific event handlers
      if (parsed.type) {
        this.emit(parsed.type, parsed);
      }
    } catch (error) {
      logger.error('Message parsing error', error as Error);
      this.emit('parseError', data);
    }
  }

  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info('Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
    });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      logger.error('Reconnection failed', error as Error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnect();
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.state === WebSocketState.OPEN && this.ws) {
        try {
          this.send({ type: 'ping' });
        } catch (error) {
          logger.error('Heartbeat failed', error as Error);
        }
      }
    }, parseInt(process.env.STREAMING_HEARTBEAT_INTERVAL_MS || '30000'));
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

/**
 * Server-Sent Events (SSE) handler
 */
export async function streamSSE(
  url: string,
  onData: (data: Record<string, unknown>) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new StreamingError(
        `SSE stream failed with status ${response.status}`
      );
    }

    if (!response.body) {
      throw new StreamingError('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let isAborted = false;

    const processStream = async () => {
      try {
        while (!isAborted) {
          const { done, value } = await reader.read();

          if (done) {
            logger.info('SSE stream ended');
            break;
          }

          const text = decoder.decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onData(data);
              } catch (parseError) {
                logger.error('SSE parse error', parseError as Error);
                if (onError) {
                  onError(parseError as Error);
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error('SSE stream error', error as Error);
        if (onError) {
          onError(error as Error);
        }
      }
    };

    processStream();

    // Return abort function
    return () => {
      isAborted = true;
      reader.cancel();
    };
  } catch (error) {
    logger.error('Failed to setup SSE stream', error as Error);
    throw new StreamingError('Failed to setup SSE stream', {
      url,
      error: String(error),
    });
  }
}

/**
 * Market data streaming manager
 */
export class MarketDataStream {
  private ws: ApexWebSocket | null = null;
  private subscriptions: Set<string> = new Set();

  async connect(wsUrl: string): Promise<void> {
    this.ws = new ApexWebSocket(wsUrl);
    await this.ws.connect();
  }

  subscribe(symbol: string, onData: (data: any) => void): () => void {
    if (!this.ws) {
      throw new StreamingError('WebSocket not connected');
    }

    this.ws.on(`market:${symbol}`, onData);
    this.subscriptions.add(symbol);

    // Send subscribe message
    this.ws.send({
      type: 'subscribe',
      symbol,
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(symbol);
    };
  }

  unsubscribe(symbol: string): void {
    if (this.ws) {
      this.ws.send({
        type: 'unsubscribe',
        symbol,
      });
      this.subscriptions.delete(symbol);
    }
  }

  isConnected(): boolean {
    return this.ws?.getState() === WebSocketState.OPEN;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      await this.ws.disconnect();
    }
    this.subscriptions.clear();
  }
}
