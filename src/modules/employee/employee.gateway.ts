import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { isCorsOriginAllowed } from '../../common/config/cors.config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
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
  namespace: '/employees',
  pingInterval: 25000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
})
export class EmployeeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmployeeGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Employee WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.userId = payload.sub;
      client.userRole = payload.role;

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (User: ${payload.sub}, Role: ${payload.role})`,
      );
      client.emit('connected', {
        socketId: client.id,
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_organization')
  handleJoinOrganization(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { organizationId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = `org:${payload.organizationId}`;
    client.join(room);
    this.logger.log(
      `User ${client.userId} joined employee room for org ${payload.organizationId}`,
    );
    client.emit('joined_organization', {
      organizationId: payload.organizationId,
      success: true,
    });
  }

  @SubscribeMessage('leave_organization')
  handleLeaveOrganization(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { organizationId: string },
  ) {
    const room = `org:${payload.organizationId}`;
    client.leave(room);
    client.emit('left_organization', {
      organizationId: payload.organizationId,
    });
  }

  emitEmployeeStatusChanged(
    organizationId: string,
    data: {
      employeeId: string;
      userId: string;
      firstName: string;
      lastName: string;
      status: string;
    },
  ) {
    const room = `org:${organizationId}`;
    this.server.to(room).emit('employee_status_changed', data);
    this.logger.log(
      `Emitted employee_status_changed for employee ${data.employeeId} in org ${organizationId}`,
    );
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const auth = client.handshake.auth;
    if (auth && auth.token) {
      return auth.token;
    }

    const queryToken = client.handshake.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
