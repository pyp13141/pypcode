import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { LeaderboardEntry, LeaderboardsService } from './leaderboards.service';

class LeaderboardParams {
  @IsOptional() @IsIn(['contribution', 'content', 'growth']) type?: string;
}

/** GET /api/v1/community/leaderboards — 契约：docs/modules/community/leaderboards.md */
@ApiTags('community')
@Controller('community/leaderboards')
export class LeaderboardsController {
  constructor(@Inject(LeaderboardsService) private readonly service: LeaderboardsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '榜单（contribution|content|growth；规则随响应下发）' })
  @ApiOkResponse({ description: '{ type, rule, entries: LeaderboardEntry[] }' })
  async board(@Query() query: LeaderboardParams): Promise<{ type: string; rule: string; entries: LeaderboardEntry[] }> {
    return this.service.board(query.type ?? 'contribution');
  }
}
