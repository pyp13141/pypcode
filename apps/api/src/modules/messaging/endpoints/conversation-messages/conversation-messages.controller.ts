import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { ConversationMessagesService, MessageView } from './conversation-messages.service';

class SendMessageDto {
  @IsString() @Length(1, 500) content!: string;
}

class ListMessagesParams {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** GET/POST /api/v1/conversations/:id/messages — 契约：docs/modules/messaging/conversation-messages.md */
@ApiTags('messaging')
@Controller('conversations')
export class ConversationMessagesController {
  constructor(@Inject(ConversationMessagesService) private readonly service: ConversationMessagesService) {}

  @Get(':id/messages')
  @ApiOperation({ summary: '会话消息（仅参与方；分页）' })
  @ApiOkResponse({ description: '分页：data 为 MessageView[]（含 riskTip 风险提醒）' })
  async list(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Query() query: ListMessagesParams): Promise<Paginated<MessageView>> {
    return this.service.list(id, auth.id, query.page, query.pageSize);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: '发送消息（参与方；10 条/分钟；关键词风险提醒）' })
  @ApiOkResponse({ description: 'MessageView' })
  async create(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto): Promise<MessageView> {
    return this.service.create(id, auth.id, dto.content);
  }
}
