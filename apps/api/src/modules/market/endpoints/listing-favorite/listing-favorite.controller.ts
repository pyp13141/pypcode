import { Controller, Delete, Inject, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { FavoriteView, ListingFavoriteService } from './listing-favorite.service';

/** PUT/DELETE /api/v1/market/listings/:id/favorite — 契约：docs/modules/market/listing-favorite.md */
@ApiTags('market')
@Controller('market/listings')
export class ListingFavoriteController {
  constructor(@Inject(ListingFavoriteService) private readonly service: ListingFavoriteService) {}

  @Put(':id/favorite')
  @ApiOperation({ summary: '收藏（幂等）' })
  @ApiOkResponse({ description: '{ listingId, favorited, favoriteCount }' })
  async favorite(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<FavoriteView> {
    return this.service.favorite(id, auth.id);
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: '取消收藏（幂等）' })
  @ApiOkResponse({ description: '{ listingId, favorited, favoriteCount }' })
  async unfavorite(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<FavoriteView> {
    return this.service.unfavorite(id, auth.id);
  }
}
