// src/modules/notification/notification.controller.ts
import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  import { NotificationService } from './notification.service';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { ReqWithRequester } from '../../share';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { UuidZodValidationPipe } from '../../share/pipes/uuid-validation.pipe';
  
  @ApiTags('notifications')
  @Controller('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}
  
    @ApiOperation({ summary: 'Get user notifications' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns paginated notifications for the user' 
    })
    @Get()
    async getUserNotifications(
      @Request() req: ReqWithRequester,
      @Query('page') page = 1,
      @Query('limit') limit = 10,
    ) {
      const result = await this.notificationService.getUserNotifications(
        req.requester.sub,
        +page,
        +limit,
      );
      return { success: true, ...result };
    }
  
    @ApiOperation({ summary: 'Get unread notification count' })
    @ApiResponse({ status: 200, description: 'Returns count of unread notifications' })
    @Get('unread-count')
    async getUnreadCount(@Request() req: ReqWithRequester) {
      const count = await this.notificationService.getUnreadCount(req.requester.sub);
      return { success: true, data: { count } };
    }
  
    @ApiOperation({ summary: 'Mark a notification as read' })
    @ApiResponse({ status: 200, description: 'Notification marked as read' })
    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    async markAsRead(
      @Request() req: ReqWithRequester,
      @Param('id', UuidZodValidationPipe) id: string,
    ) {
      await this.notificationService.markAsRead(req.requester.sub, id);
      return { success: true, message: 'Notification marked as read' };
    }
  
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiResponse({ status: 200, description: 'All notifications marked as read' })
    @Post('read-all')
    @HttpCode(HttpStatus.OK)
    async markAllAsRead(@Request() req: ReqWithRequester) {
      await this.notificationService.markAllAsRead(req.requester.sub);
      return { success: true, message: 'All notifications marked as read' };
    }
  
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiResponse({ status: 200, description: 'Notification deleted' })
    @Delete(':id')
    async deleteNotification(
      @Request() req: ReqWithRequester,
      @Param('id', UuidZodValidationPipe) id: string,
    ) {
      await this.notificationService.deleteNotification(req.requester.sub, id);
      return { success: true, message: 'Notification deleted' };
    }
  }