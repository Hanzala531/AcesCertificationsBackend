import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectionManagerService } from './connection-manager.service';
import { NotificationPayload } from '../types/notification.types';
import { isCorsOriginAllowed } from '../../../common/config/cors.config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
}

@WebSocketGateway({
  cors: {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isCorsOriginAllowed(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${requestOrigin}`), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowEIO3: true,
  },
  namespace: '/notifications',
  pingInterval: 25000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Notification WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(
          `[Notification] Connection rejected: No token provided for socket ${client.id}. Headers: ${JSON.stringify(client.handshake.headers)}, Auth: ${JSON.stringify(client.handshake.auth)}`,
        );
        client.disconnect(true);
        return;
      }

      this.logger.debug(`[Notification] Token extracted for socket ${client.id}`);
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(
          `[Notification] Connection rejected: Invalid token for socket ${client.id}`,
        );
        client.disconnect(true);
        return;
      }

      client.userId = payload.sub;
      client.role = payload.role;

      this.connectionManager.addConnection(
        client.id,
        payload.sub,
        payload.role,
      );

      this.logger.log(
        `Client connected: ${client.id} (User: ${payload.sub}, Role: ${payload.role})`,
      );

      client.emit('connected', {
        socketId: client.id,
        userId: payload.sub,
        role: payload.role,
      });
    } catch (error) {
      this.logger.error(
        `[Notification] Connection error for socket ${client.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectionManager.removeConnection(client.id);
      this.logger.log(
        `Client disconnected: ${client.id} (User: ${client.userId})`,
      );
    }
  }

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const sockets = this.connectionManager.getUserSockets(userId);
    if (sockets.length === 0) {
      this.logger.debug(
        `User ${userId} is not connected. Notification will not be delivered.`,
      );
      return;
    }

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification', payload);
    });

    this.logger.debug(
      `Notification sent to user ${userId} via ${sockets.length} socket(s)`,
    );
  }

  async sendToUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    const promises = uniqueUserIds.map((userId) =>
      this.sendToUser(userId, payload),
    );
    await Promise.all(promises);
  }

  async sendToRole(role: string, payload: NotificationPayload): Promise<void> {
    const sockets = this.connectionManager.getRoleSockets(role);
    if (sockets.length === 0) {
      this.logger.debug(
        `No users with role ${role} are connected. Notification will not be delivered.`,
      );
      return;
    }

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification', payload);
    });

    this.logger.debug(
      `Notification sent to role ${role} via ${sockets.length} socket(s)`,
    );
  }

  async sendToRoles(
    roles: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    const uniqueRoles = [...new Set(roles)];
    const promises = uniqueRoles.map((role) => this.sendToRole(role, payload));
    await Promise.all(promises);
  }

  async broadcast(payload: NotificationPayload): Promise<void> {
    this.server.emit('notification', payload);
    const connectionCount = this.connectionManager.getConnectionCount();
    this.logger.debug(
      `Broadcast notification sent to ${connectionCount} connected client(s)`,
    );
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const token = client.handshake.auth?.token;
    if (token) {
      return token;
    }

    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      this.logger.debug(`[Notification] Verifying token with JWT_SECRET present: ${!!jwtSecret}`);
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      this.logger.debug(`[Notification] Token verified successfully. User: ${payload.sub}`);
      return payload;
    } catch (error) {
      this.logger.warn(
        `[Notification] Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
