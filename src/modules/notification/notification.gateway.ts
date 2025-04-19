// src/modules/notification/notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, UseGuards } from '@nestjs/common';
import { TOKEN_SERVICE } from '../auth/auth.di-token';
import { ITokenService } from '../auth/auth.interface';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Validate token from handshake
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('Connection attempt without token');
        client.disconnect();
        return;
      }

      const payload = await this.tokenService.verifyToken(token);
      if (!payload) {
        this.logger.warn('Connection attempt with invalid token');
        client.disconnect();
        return;
      }

      // Add client to user's socket set
      const userId = payload.sub;
      client.data.userId = userId;

      // Add to rooms based on organizational structure
      client.join(`user:${userId}`);
      
      if (payload.factoryId) {
        client.join(`factory:${payload.factoryId}`);
      }
      if (payload.lineId) {
        client.join(`line:${payload.lineId}`);
      }
      if (payload.teamId) {
        client.join(`team:${payload.teamId}`);
      }
      if (payload.groupId) {
        client.join(`group:${payload.groupId}`);
      }

      // Keep track of user's socket connections
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(client.id);

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Send notification to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`Sent ${event} to user ${userId}`);
  }

  // Send notification to all users in an organizational unit
  sendToOrganizationalUnit(unitType: string, unitId: string, event: string, data: any) {
    this.server.to(`${unitType}:${unitId}`).emit(event, data);
    this.logger.debug(`Sent ${event} to ${unitType} ${unitId}`);
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Broadcast ${event} to all users`);
  }

  // Listen for read/unread status changes
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notification:read')
  handleNotificationRead(client: Socket, payload: { notificationId: string }) {
    try {
      // Update business logic for read notification
      this.logger.log(
        `Notification ${payload.notificationId} marked as read by ${client.data.userId}`
      );
      return { success: true };
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  // Get unread count
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notification:unread-count')
  handleUnreadCount(client: Socket) {
    try {
      // Return mock data for now
      return { count: Math.floor(Math.random() * 10) };
    } catch (error) {
      throw new WsException(error.message);
    }
  }
}