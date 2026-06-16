import { Injectable, Logger } from '@nestjs/common';
import { ConnectionInfo } from '../types/notification.types';

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly connections = new Map<string, ConnectionInfo>();
  private readonly userConnections = new Map<string, Set<string>>();
  private readonly roleConnections = new Map<string, Set<string>>();

  addConnection(socketId: string, userId: string, role: string): void {
    const connectionInfo: ConnectionInfo = {
      socketId,
      userId,
      role,
      connectedAt: new Date(),
    };

    this.connections.set(socketId, connectionInfo);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socketId);

    if (!this.roleConnections.has(role)) {
      this.roleConnections.set(role, new Set());
    }
    this.roleConnections.get(role)!.add(socketId);

    this.logger.debug(
      `Connection added: ${socketId} for user ${userId} (${role}). Total connections: ${this.connections.size}`,
    );
  }

  removeConnection(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) {
      return;
    }

    this.connections.delete(socketId);

    const userSockets = this.userConnections.get(connection.userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    const roleSockets = this.roleConnections.get(connection.role);
    if (roleSockets) {
      roleSockets.delete(socketId);
      if (roleSockets.size === 0) {
        this.roleConnections.delete(connection.role);
      }
    }

    this.logger.debug(
      `Connection removed: ${socketId} for user ${connection.userId}. Total connections: ${this.connections.size}`,
    );
  }

  getConnection(socketId: string): ConnectionInfo | undefined {
    return this.connections.get(socketId);
  }

  getUserSockets(userId: string): string[] {
    const sockets = this.userConnections.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  getRoleSockets(role: string): string[] {
    const sockets = this.roleConnections.get(role);
    return sockets ? Array.from(sockets) : [];
  }

  getAllSockets(): string[] {
    return Array.from(this.connections.keys());
  }

  getUserIds(): string[] {
    return Array.from(this.userConnections.keys());
  }

  getOnlineUsers(): string[] {
    return this.getUserIds();
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userConnections.get(userId);
    return sockets ? sockets.size > 0 : false;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionCountByUser(userId: string): number {
    const sockets = this.userConnections.get(userId);
    return sockets ? sockets.size : 0;
  }

  getConnectionCountByRole(role: string): number {
    const sockets = this.roleConnections.get(role);
    return sockets ? sockets.size : 0;
  }
}
