import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MarketDealsService } from '../../market-deals.service';
import { DEAL_STATUSES } from '../../market-state';
import { MarketDealView, toDealView } from '../../market-view';

export interface CreateDealInput {
  listingId: string;
  message?: string;
}

export interface ListDealsQuery {
  status?: string;
  role?: string;
  page?: string;
  pageSize?: string;
}

/**
 * POST/GET /api/v1/market/deals — 契约：docs/modules/market/deals.md
 * 创建交易（CONTACTED）+ 受限会话；不托管资金；一物一单由 agree/complete 事务保证。
 */
@Injectable()
export class DealsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async create(buyerUserId: string, input: CreateDealInput): Promise<MarketDealView> {
    const listing = await this.prisma.marketListing.findUnique({
      where: { id: input.listingId },
      select: { id: true, status: true, sellerUserId: true, title: true },
    });
    if (!listing || listing.status !== 'PUBLISHED') {
      throw new ConflictException({ code: ERROR_CODES.LISTING_NOT_AVAILABLE, message: '列表不存在或不可交易' });
    }
    if (listing.sellerUserId === buyerUserId) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '不能与自己发起交易' });
    }
    const existing = await this.prisma.marketDeal.findFirst({
      where: { listingId: input.listingId, buyerUserId, status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPUTED'] } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.DEAL_ALREADY_IN_PROGRESS,
        message: '你与该物品已有进行中的交易，请继续原交易',
      });
    }

    const deal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketDeal.create({
        data: {
          listingId: input.listingId,
          buyerUserId,
          sellerUserId: listing.sellerUserId,
          status: 'CONTACTED',
        },
      });
      const conversation = await tx.conversation.create({
        data: {
          conversationType: 'MARKET_DEAL',
          relatedDealId: created.id,
          participants: { create: [{ userId: buyerUserId }, { userId: listing.sellerUserId }] },
        },
      });
      const message = input.message?.trim();
      if (message) {
        await tx.message.create({
          data: { conversationId: conversation.id, senderUserId: buyerUserId, content: message },
        });
      }
      await this.deals.writeEvent(tx, {
        marketDealId: created.id,
        fromStatus: null,
        toStatus: 'CONTACTED',
        actorUserId: buyerUserId,
        actorRole: 'BUYER',
        reasonCode: 'DEAL_CREATED',
        note: message ? `初始留言：${message.slice(0, 100)}` : undefined,
      });
      return { ...created, conversationId: conversation.id };
    });

    await this.notifications.push(listing.sellerUserId, 'DEAL_CREATED', { dealId: deal.id, listingId: input.listingId });
    const full = await this.prisma.marketDeal.findUniqueOrThrow({
      where: { id: deal.id },
      include: {
        buyer: true,
        seller: true,
        listing: { include: { media: { select: { mediaAssetId: true, sortOrder: true } } } },
        conversation: { select: { id: true } },
      },
    });
    return toDealView(full, buyerUserId);
  }

  /**
   * GET /market/deals/:id — 契约：docs/modules/market/deal-by-id.md
   * 仅参与方（非参与方 404 不泄露存在性，与 care 订单同语义）。
   * 2026-10-11 补口：客户端交易详情页一直调用本路由，此前契约/实现均缺失（UX-REVIEW P0-3）。
   */
  async getById(userId: string, dealId: string): Promise<MarketDealView> {
    const deal = await this.prisma.marketDeal.findUnique({
      where: { id: dealId },
      include: {
        buyer: true,
        seller: true,
        listing: { include: { media: { select: { mediaAssetId: true, sortOrder: true } } } },
        conversation: { select: { id: true } },
      },
    });
    if (!deal || (deal.buyerUserId !== userId && deal.sellerUserId !== userId)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '交易不存在' });
    }
    return toDealView(deal, userId);
  }

  async list(userId: string, query: ListDealsQuery): Promise<Paginated<MarketDealView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    if (query.status && !(DEAL_STATUSES as readonly string[]).includes(query.status)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'status 不合法' });
    }
    if (query.role && !['BUYER', 'SELLER'].includes(query.role)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'role 需为 BUYER/SELLER' });
    }
    const where = {
      ...(query.role === 'BUYER'
        ? { buyerUserId: userId }
        : query.role === 'SELLER'
          ? { sellerUserId: userId }
          : { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] }),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.marketDeal.count({ where }),
      this.prisma.marketDeal.findMany({
        where,
        include: {
          buyer: true,
          seller: true,
          listing: { include: { media: { select: { mediaAssetId: true, sortOrder: true } } } },
          conversation: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return paginate(rows.map((row) => toDealView(row, userId)), page, pageSize, total);
  }
}
