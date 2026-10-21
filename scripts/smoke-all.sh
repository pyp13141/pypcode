#!/usr/bin/env bash
# 全量线上冒烟（docs/TEST-REPORT.md 的执行器）：对运行中的 API 逐模块验证。
# 用法: bash scripts/smoke-all.sh [BASE]   默认 http://127.0.0.1:3001/api/v1
# 注意：邮箱发码走真实 SMTP（收件箱=126 发件邮箱），126 限流 1 次/分钟/邮箱，
#       两次运行至少间隔 1 分钟，否则第一项"邮箱发码"会 429。
#       幂等键均带 $RUN_ID（幂等存储跨运行持久，固定键会在第二次运行时 409 冲突）。
set -u
BASE="${1:-http://127.0.0.1:3001/api/v1}"
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1" 2>/dev/null; }
JX() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
RUN_ID="smoke$(date +%s)"
PASS=0; FAIL=0; DETAILS=""

# 真实 SMTP 上线（D-014 #8）后验证码只经真实邮件送达，不进日志/接口：
# 用 IMAP 从 126 收件箱取最新一封"宠邻登录验证码"邮件的主题码，顺带验证邮件真实送达。
# NetEase 要求登录后发 IMAP ID 命令否则拒连，imaplib 需先注册 ID 指令。
fetch_latest_email_code() { # $1=收件邮箱 $2=授权码 $3=发码时刻(epoch 秒，只认其后的邮件)
  python3 - "$1" "$2" "$3" <<'PY'
import imaplib, email, re, sys, time
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
user, pwd, since = sys.argv[1], sys.argv[2], float(sys.argv[3])
imaplib.Commands['ID'] = ('AUTH', 'SELECTED', 'LOGOUT')
try:
    M = imaplib.IMAP4_SSL('imap.126.com', 993)
    M.login(user, pwd)
    M._simple_command('ID', '("name" "petn-smoke" "version" "1.0")')
    M.select('INBOX')
    code = ''
    for _ in range(10):  # 投递有延迟，最多等 30s
        typ, data = M.search(None, 'ALL')
        ids = (data[0].split() if data[0] else [])[-15:]
        for i in reversed(ids):
            typ, md = M.fetch(i, '(BODY[HEADER.FIELDS (SUBJECT DATE)])')
            msg = email.message_from_bytes(md[0][1])
            subj = str(make_header(decode_header(msg.get('Subject', ''))))
            if '验证码' not in subj:
                continue
            try:
                if parsedate_to_datetime(msg['Date']).timestamp() + 2 < since:
                    continue  # 上一轮的旧码邮件
            except Exception:
                pass
            m = re.search(r'(\d{6})', subj)
            code = m.group(1) if m else ''
            break
        if code:
            break
        time.sleep(3)
    M.logout()
    print(code)
except Exception:
    print('')
PY
}

check() { # check <名称> <期望> <实际>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); DETAILS="${DETAILS}✅ $1\n";
  else FAIL=$((FAIL+1)); DETAILS="${DETAILS}❌ $1（期望 $2，实际 $3）\n"; fi
}
CODE() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# ===== 1. 系统/公开接口 =====
check "health 健康检查" 200 "$(CODE $BASE/health)"
check "meta 公开元信息" 200 "$(CODE $BASE/meta)"
check "地铁城市列表" 200 "$(CODE $BASE/transit/cities)"

# ===== 2. 认证：邮箱验证码全链路（发码→真实邮件送达→IMAP 取码→登录）=====
ENV_FILE="${PETN_ENV_FILE:-/etc/pet-neighbor/api.env}"
SMTP_USER=$(grep -E '^SMTP_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
SMTP_PASS=$(grep -E '^SMTP_PASS=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
check "SMTP 凭据可读" 0 "$([ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; echo $?)"
SEND_AT=$(date +%s)
check "邮箱发码" 200 "$(CODE -X POST $BASE/auth/email/send-code -H 'Content-Type: application/json' -d "{\"email\":\"$SMTP_USER\"}")"
check "邮箱发码限流 429" 429 "$(CODE -X POST $BASE/auth/email/send-code -H 'Content-Type: application/json' -d "{\"email\":\"$SMTP_USER\"}")"
CODE_FROM_LOG=$(fetch_latest_email_code "$SMTP_USER" "$SMTP_PASS" "$SEND_AT")
EMAIL="$SMTP_USER"
AUTH=$(curl -s -X POST $BASE/auth/email/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE_FROM_LOG\"}")
TA=$(echo "$AUTH" | J "['data']['accessToken']")
UA=$(echo "$AUTH" | J "['data']['user']['id']")
check "邮箱登录出令牌" 43 "${#TA}"
check "/me 邮箱已验证" True "$(curl -s $BASE/me -H "Authorization: Bearer $TA" | J "['data']['emailVerified']")"
# 微信 Mock 登录（客户端另一入口）
WB=$(curl -s -X POST $BASE/auth/wechat/login -H 'Content-Type: application/json' -d "{\"code\":\"$RUN_ID-b\"}")
TB=$(echo "$WB" | J "['data']['accessToken']"); UB=$(echo "$WB" | J "['data']['user']['id']")
check "微信 Mock 登录" 43 "${#TB}"
PGPASSWORD=$(cat "${PETN_DB_PASSWORD_FILE:-/etc/pet-neighbor/db-password}") psql -h 127.0.0.1 -U petn_app -d pet_neighbor -qc "UPDATE users SET created_at = now() - interval '3 days' WHERE id IN ('$UA','$UB');" 2>/dev/null
check "冒烟账号转成熟(机审放行前置)" 0 "$?"

# ===== 3. 宠物 =====
PET=$(curl -s -X POST $BASE/pets -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"name":"冒烟豆","species":"CAT"}' | J "['data']['id']")
check "宠物建档" 36 "${#PET}"

# ===== 4. 互助闭环（发布→申请→accept→确认→地址→开始→上门→完成→评价→徽章）=====
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ); LATER=$(date -u -d "+3 hours" +%Y-%m-%dT%H:%M:%SZ)
REQ=$(curl -s -X POST $BASE/care/requests -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d "{\"petIds\":[\"$PET\"],\"serviceType\":\"FEED\",\"title\":\"全量冒烟需求\",\"description\":\"x\",\"areaCode\":\"440305\",\"startAt\":\"$NOW\",\"endAt\":\"$LATER\",\"pricingType\":\"FREE\",\"cancelRule\":\"FREE\"}")
RID=$(echo "$REQ" | J "['data']['id']")
check "发布求助需求" 36 "${#RID}"
APP=$(curl -s -X POST $BASE/care/requests/$RID/applications -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"message":"我来"}')
AID=$(echo "$APP" | J "['data']['id']")
check "提交申请" 36 "${#AID}"
ORD=$(curl -s -X POST $BASE/care/applications/$AID/accept -H "Authorization: Bearer $TA" -H "Idempotency-Key: smoke-accept-$RUN_ID")
OID=$(echo "$ORD" | J "['data']['orderId']")
ACC2=$(curl -s -X POST $BASE/care/applications/$AID/accept -H "Authorization: Bearer $TA" -H "Idempotency-Key: smoke-accept-$RUN_ID")
check "accept 幂等重放同一订单" "$OID" "$(echo "$ACC2" | J "['data']['orderId']")"
check "无地址确认被拦 409" 409 "$(CODE -X POST $BASE/care/orders/$OID/confirm -H "Authorization: Bearer $TB")"
check "私密地址写入" 200 "$(CODE -X PUT $BASE/care/orders/$OID/private-details -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"address":"冒烟路1号"}')"
check "需求方确认" 200 "$(CODE -X POST $BASE/care/orders/$OID/confirm -H "Authorization: Bearer $TA")"
check "服务者确认→CONFIRMED" CONFIRMED "$(curl -s -X POST $BASE/care/orders/$OID/confirm -H "Authorization: Bearer $TB" | J "['data']['status']")"
check "服务者读地址（审计）" "冒烟路1号" "$(curl -s $BASE/care/orders/$OID/private-details -H "Authorization: Bearer $TB" | J "['data']['address']")"
TC=$(curl -s -X POST $BASE/auth/wechat/login -H 'Content-Type: application/json' -d "{\"code\":\"$RUN_ID-c2\"}" | J "['data']['accessToken']")
check "非参与方读地址 403" 403 "$(CODE $BASE/care/orders/$OID/private-details -H "Authorization: Bearer $TC")"
check "开始服务" IN_PROGRESS "$(curl -s -X POST $BASE/care/orders/$OID/start -H "Authorization: Bearer $TB" | J "['data']['status']")"
V=$(curl -s -X POST $BASE/care/orders/$OID/visits -H "Authorization: Bearer $TB" -H "Idempotency-Key: smoke-v1-$RUN_ID" -H 'Content-Type: application/json' -d "{\"scheduledAt\":\"$NOW\"}")
VID=$(echo "$V" | J "['data']['id']")
check "创建上门（幂等键）" 1 "$(echo "$V" | J "['data']['seq']")"
check "上门完成" COMPLETED "$(curl -s -X PATCH $BASE/care/orders/$OID/visits/$VID -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"action":"COMPLETE","evidence":[{"evidenceType":"NOTE","note":"已喂食"}]}' | J "['data']['status']")"
check "服务者提交完成" COMPLETION_SUBMITTED "$(curl -s -X POST $BASE/care/orders/$OID/complete -H "Authorization: Bearer $TB" -H "Idempotency-Key: smoke-c1-$RUN_ID" | J "['data']['status']")"
check "需求方确认完成" COMPLETED "$(curl -s -X POST $BASE/care/orders/$OID/complete -H "Authorization: Bearer $TA" -H "Idempotency-Key: smoke-c2-$RUN_ID" | J "['data']['status']")"
check "双向评价" 5 "$(curl -s -X POST $BASE/care/orders/$OID/reviews -H "Authorization: Bearer $TA" -H "Idempotency-Key: smoke-r1-$RUN_ID" -H 'Content-Type: application/json' -d '{"rating":5}' | J "['data']['rating']")"
check "重复评价 409" 409 "$(CODE -X POST $BASE/care/orders/$OID/reviews -H "Authorization: Bearer $TA" -H "Idempotency-Key: smoke-r2-$RUN_ID" -H 'Content-Type: application/json' -d '{"rating":4}')"
check "CARE_FIRST 徽章" True "$(curl -s $BASE/badges -H "Authorization: Bearer $TB" | JX "any(b['code']=='CARE_FIRST' for b in d['data']['earned'])")"

# ===== 5. 集市 + 媒体管线 =====
MA=$(curl -s -X POST $BASE/media/upload-authorizations -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"purpose":"LISTING_IMAGE","count":1}')
MID=$(echo "$MA" | J "['data'][0]['mediaId']"); UP=$(echo "$MA" | J "['data'][0]['uploadPath']")
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > /tmp/smoke.png
check "媒体直传" 200 "$(CODE -X PUT "http://127.0.0.1:3001$UP" -H 'Content-Type: image/png' --data-binary @/tmp/smoke.png)"
check "finalize 登记" PENDING "$(curl -s -X POST $BASE/media/$MID/finalize -H "Authorization: Bearer $TB" | J "['data']['moderationStatus']")"
LST=$(curl -s -X POST $BASE/market/listings -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d "{\"listingType\":\"GIFT\",\"categoryCode\":\"TOYS\",\"title\":\"冒烟赠送猫玩具\",\"description\":\"x\",\"areaCode\":\"440305\",\"images\":[\"$MID\"]}")
LID=$(echo "$LST" | J "['data']['id']")
check "发布闲置(GIFT)" PUBLISHED "$(echo "$LST" | J "['data']['status']")"
D=$(curl -s -X POST $BASE/market/deals -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d "{\"listingId\":\"$LID\",\"message\":\"想要\"}")
DID=$(echo "$D" | J "['data']['id']")
CONV=$(echo "$D" | J "['data']['conversationId']")
check "发起交易+会话" 36 "${#DID}"
check "交易会话随建返回" 36 "${#CONV}"
curl -s -X POST $BASE/market/deals/$DID/agree -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"handoverArea":"冒烟广场"}' > /dev/null
check "双方约定→AGREED" AGREED "$(curl -s -X POST $BASE/market/deals/$DID/agree -H "Authorization: Bearer $TB" | J "['data']['status']")"
curl -s -X POST $BASE/market/deals/$DID/complete -H "Authorization: Bearer $TA" > /dev/null
check "交接原子关闭商品" SOLD "$(curl -s $BASE/market/listings/$LID -H "Authorization: Bearer $TB" | J "['data']['status']")"
check "交易完成" COMPLETED "$(curl -s -X POST $BASE/market/deals/$DID/complete -H "Authorization: Bearer $TB" | J "['data']['status']")"
# conversationId 契约上只随 POST /market/deals 返回（无 GET /market/deals/:id 路由）
check "会话消息+风险提醒" True "$(curl -s -X POST $BASE/conversations/$CONV/messages -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"content":"加微信转账给你"}' | JX "d['data']['riskTip'] is not None")"

# ===== 6. 社区 =====
P=$(curl -s -X POST $BASE/community/posts -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"content":"冒烟测试动态：今天猫咪很乖"}')
PID=$(echo "$P" | J "['data']['id']")
check "发帖（成熟账号直发）" APPROVED "$(echo "$P" | J "['data']['moderationStatus']")"
check "评论" 36 "${#$(curl -s -X POST $BASE/community/posts/$PID/comments -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"content":"好可爱"}' | J "['data']['id']"):0}"
check "点赞计数" 1 "$(curl -s -X POST $BASE/community/reactions -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d "{\"targetType\":\"POST\",\"targetId\":\"$PID\",\"reactionType\":\"LIKE\"}" | J "['data']['count']")"
check "关注流" 200 "$(CODE -X PUT $BASE/community/users/$UB/follow -H "Authorization: Bearer $TA")"
check "求助帖白名单 400" 400 "$(CODE -X POST $BASE/community/help-posts -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"category":"ERRAND","title":"帮忙取快递测试","content":"x"}')"
check "举报" NEW "$(curl -s -X POST $BASE/reports -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d "{\"targetType\":\"POST\",\"targetId\":\"$PID\",\"reason\":\"AD\"}" | J "['data']['status']")"

# ===== 7. 通知/健康/后台 =====
check "通知列表" 200 "$(CODE $BASE/notifications -H "Authorization: Bearer $TA")"
check "健康日志记录" 201 "$(CODE -X POST $BASE/pets/$PET/health-logs -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d "{\"logType\":\"WEIGHT\",\"valueNum\":4,\"unit\":\"kg\",\"recordedAt\":\"$NOW\"}")"
check "情绪日志校验 400" 400 "$(CODE -X POST $BASE/pets/$PET/mood-logs -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d "{\"moodTags\":[\"乱写\"],\"observedAt\":\"$NOW\"}")"
check "后台无权限 403" 403 "$(CODE $BASE/admin/users -H "Authorization: Bearer $TA")"
check "growth 榜单" 200 "$(CODE "$BASE/community/leaderboards?type=growth")"
check "互助贡献榜" 200 "$(CODE "$BASE/community/leaderboards?type=contribution")"

# ===== 8. 生产入口（Caddy /petn/api）=====
PB="http://127.0.0.1/petn/api/v1"
PETN_HOST="${PETN_HOST:-127.0.0.1}"
check "生产入口 feed" 200 "$(CODE -H "Host: $PETN_HOST" $PB/community/feed)"
check "生产入口发码" 200 "$(CODE -X POST -H "Host: $PETN_HOST" $PB/auth/email/send-code -H 'Content-Type: application/json' -d "{\"email\":\"prod.$RUN_ID@example.com\"}")"
# ===== 9. 预览入口（devServer 代理，默认 18080）=====
PREVIEW_URL="${PETN_PREVIEW_URL:-http://127.0.0.1:18080}"
check "预览入口发码(18080)" 200 "$(CODE -X POST "$PREVIEW_URL/petn/api/v1/auth/email/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"preview.$RUN_ID@example.com\"}")"

echo -e "$DETAILS"
echo "=============================="
echo "通过 $PASS / $((PASS+FAIL))，失败 $FAIL"
[ "$FAIL" -eq 0 ] && echo "ALL GREEN" || exit 1
