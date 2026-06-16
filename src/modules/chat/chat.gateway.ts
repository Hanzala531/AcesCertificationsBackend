import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatMessageWithSender } from './types/chat.types';
import { isCorsOriginAllowed } from '../../common/config/cors.config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface JoinRoomPayload {
  threadId: string;
}

interface SendMessagePayload {
  threadId: string;
  content: string;
}

interface TypingPayload {
  threadId: string;
  isTyping: boolean;
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
    allowEIO3: true,
    credentials: true,
  },
  namespace: '/chat',
  pingInterval: 25000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway initialized');
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

      const userId = client.userId as string;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
      client.emit('connected', { socketId: client.id, userId: client.userId });
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

  @SubscribeMessage('join_thread')
  async handleJoinThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    try {
      if (!client.userId) {
        throw new WsException('Unauthorized');
      }

      // Admins can always join; others must be participants
      const isAdmin =
        client.userRole === 'admin' || client.userRole === 'subadmin';

      if (!isAdmin) {
        const isParticipant = await this.chatService.isParticipant(
          payload.threadId,
          client.userId,
        );

        if (!isParticipant) {
          throw new WsException('Not a participant in this chat');
        }
      }

      const roomName = `thread:${payload.threadId}`;
      await client.join(roomName);

      this.logger.log(
        `User ${client.userId} (${client.userRole}) joined thread ${payload.threadId}`,
      );

      client.emit('joined_thread', {
        threadId: payload.threadId,
        success: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to join thread';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('leave_thread')
  async handleLeaveThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = `thread:${payload.threadId}`;
    await client.leave(roomName);
    this.logger.log(`User ${client.userId} left thread ${payload.threadId}`);
    client.emit('left_thread', { threadId: payload.threadId });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    try {
      if (!client.userId) {
        throw new WsException('Unauthorized');
      }

      if (!payload.content || payload.content.trim().length === 0) {
        throw new WsException('Message content is required');
      }

      const message = await this.chatService.sendMessage(
        payload.threadId,
        client.userId,
        payload.content.trim(),
        client.userRole,
      );

      const roomName = `thread:${payload.threadId}`;
      this.server.to(roomName).emit('new_message', this.formatMessage(message));

      return { success: true, messageId: message.id };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send message';
      client.emit('error', { message });
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ) {
    if (!client.userId) return;

    const roomName = `thread:${payload.threadId}`;
    client.to(roomName).emit('user_typing', {
      threadId: payload.threadId,
      userId: client.userId,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!client.userId) return;

    const roomName = `thread:${payload.threadId}`;
    client.to(roomName).emit('messages_read', {
      threadId: payload.threadId,
      userId: client.userId,
      readAt: new Date().toISOString(),
    });
  }

  async broadcastToThread(threadId: string, event: string, data: any) {
    const roomName = `thread:${threadId}`;
    this.server.to(roomName).emit(event, data);
  }

  async notifyNewMessage(message: ChatMessageWithSender) {
    const formatted = this.formatMessage(message);

    // Broadcast to the room (for clients who joined via join_thread)
    await this.broadcastToThread(message.thread_id, 'new_message', formatted);

    // Also send directly to all participants' connected sockets
    // This ensures delivery even if they haven't joined the room yet
    try {
      const participants =
        await this.chatService.getParticipantUserIds(message.thread_id);
      for (const userId of participants) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          for (const socketId of sockets) {
            this.server.to(socketId).emit('new_message', formatted);
          }
        }
      }

      // Emit thread_updated so frontends can update thread list
      // (new thread appearing, unread count change, latest message preview)
      this.emitThreadUpdated(message.thread_id, participants);
    } catch (error) {
      this.logger.warn(
        `Could not send direct notifications for thread ${message.thread_id}: ${error}`,
      );
    }
  }

  private async emitThreadUpdated(
    threadId: string,
    participantUserIds: string[],
  ) {
    try {
      const threadDetails =
        await this.chatService.getThreadDetails(threadId);
      if (!threadDetails) return;

      const payload = {
        threadId,
        supportTicketSubject: threadDetails.support_ticket_subject,
        supportTicketCategory: threadDetails.support_ticket_category,
        certificateName: threadDetails.certificate_name,
        organizationName: threadDetails.organization_name,
        questionText: threadDetails.question_text,
        assessmentType: threadDetails.assessment_type,
        threadType: threadDetails.thread_type,
        status: threadDetails.status,
        updatedAt: new Date().toISOString(),
      };

      for (const userId of participantUserIds) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          for (const socketId of sockets) {
            this.server.to(socketId).emit('thread_updated', payload);
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not emit thread_updated for ${threadId}: ${error}`,
      );
    }
  }

  async notifyThreadLocked(threadId: string, reason: string) {
    await this.broadcastToThread(threadId, 'thread_locked', {
      threadId,
      reason,
      lockedAt: new Date().toISOString(),
    });
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

  private formatMessage(message: ChatMessageWithSender) {
    return {
      id: message.id,
      threadId: message.thread_id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      senderRole: message.sender_role,
      content: message.content,
      isSystemMessage: message.is_system_message,
      createdAt: message.created_at,
    };
  }
}
