import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportTicketService } from './support-ticket.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import type { RequestWithUser } from '../auth/types/auth.types';
import type {
  SupportTicketStatus,
  SupportTicketTargetType,
  SupportTicketType,
} from './types/support-ticket.types';
import {
  SwaggerCreateTicket,
  SwaggerGetTickets,
  SwaggerGetTicketById,
  SwaggerUpdateTicketStatus,
  SwaggerDeleteTicket,
} from './swagger/support-ticket.swagger';

@ApiTags('Support Tickets')
@ApiBearerAuth('JWT-auth')
@Controller('support-tickets')
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  @Post()
  @Roles(
    'admin',
    'subadmin',
    'organization',
    'organization_member',
    'auditor',
    'reviewer',
  )
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateTicket()
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    const ticket = await this.supportTicketService.create(req.user.sub, dto);
    return {
      success: true,
      message: 'Support ticket created successfully',
      data: ticket,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @Roles(
    'admin',
    'subadmin',
    'organization',
    'organization_member',
    'auditor',
    'reviewer',
  )
  @SwaggerGetTickets()
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'pending',
      'triaged',
      'in-progress',
      'in_review',
      'awaiting_admin_decision',
      'resolved',
      'rejected',
      'completed',
      'closed',
    ],
  })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'certificate_id', required: false, type: String })
  @ApiQuery({
    name: 'ticket_type',
    required: false,
    enum: ['support', 'dispute', 'billing', 'technical', 'other'],
  })
  @ApiQuery({
    name: 'target_type',
    required: false,
    enum: ['certificate', 'assessment', 'payment', 'account', 'other'],
  })
  @ApiQuery({ name: 'target_id', required: false, type: String })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: SupportTicketStatus,
    @Query('category') category?: string,
    @Query('certificate_id') certificate_id?: string,
    @Query('ticket_type') ticket_type?: SupportTicketType,
    @Query('target_type') target_type?: SupportTicketTargetType,
    @Query('target_id') target_id?: string,
  ) {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'subadmin';
    const result = await this.supportTicketService.findAll({
      page: page || 1,
      limit: limit || 10,
      status,
      category,
      certificate_id,
      ticket_type,
      target_type,
      target_id,
      user_id: isAdmin ? undefined : req.user.sub,
    });
    return {
      success: true,
      message: 'Support tickets retrieved successfully',
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @Roles(
    'admin',
    'subadmin',
    'organization',
    'organization_member',
    'auditor',
    'reviewer',
  )
  @SwaggerGetTicketById()
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const ticket = await this.supportTicketService.findById(id);
    return {
      success: true,
      message: 'Support ticket retrieved successfully',
      data: ticket,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/status')
  @Roles('admin', 'subadmin')
  @SwaggerUpdateTicketStatus()
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @Request() req: RequestWithUser,
  ) {
    const ticket = await this.supportTicketService.updateStatus(
      id,
      dto.status,
      req.user.sub,
    );
    return {
      success: true,
      message: 'Ticket status updated successfully',
      data: ticket,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerDeleteTicket()
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.supportTicketService.delete(id);
    return {
      success: true,
      message: 'Support ticket deleted successfully',
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
