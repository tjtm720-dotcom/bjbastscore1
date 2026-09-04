// API route: GET /api/lookup?id=<soop_bj_id>
//
// Pulls PUBLIC, unauthenticated JSON sources at request time:
//   1. SOOP's own channel dashboard API     (official numbers: 애청자 수, 누적 방송시간, 방송 시작일)
//   2. SOOP's own channel VOD list API      (official counts: "업로드 VOD" 개수, "다시보기" 개수 — the
//                                             same endpoint the station page itself calls when you open
//                                             the VOD tab and filter to "3개월"; found via network
//                                             inspection, so no headless browser is needed for these)
//   3. poong.today's per-day stats API      (third-party estimate: daily "concurrent viewer" figure,
//                                             used as a stand-in for "평균 동접" — see caveat in the
//                                             response and in the UI)
//
// All are called directly with fetch() from this serverless function — no headless browser needed,
// so this stays fast and works on Vercel's free tier.
//
// Note on "다시보기 유지율": SOOP's official metric is "% of the last 3 months' broadcast days that
// still have a 다시보기 VOD", which isn't something the VOD-list API exposes directly (it only gives a
// raw count of VOD entries, and one broadcast day can have 0, 1, or multiple VODs). We estimate it as
// (다시보기 VOD count ÷ 3개월 방송일수), clearly labeled as an estimate — the UI keeps it editable.

const SOOP_DASHBOARD_URL = (id) => `https://api-channel.sooplive.com/v1.1/channel/${encodeURIComponent(id)}/dashboard`;
const SOOP_VOD_URL = (id, category, startDate, endDate) =>
  `https://api-channel.sooplive.com/v1.1/channel/${encodeURIComponent(id)}/vod/${category}` +
  `?startDate=${startDate}&endDate=${endDate}&keyword=&orderBy=reg_date&perPage=60&page=1&field=title,contents,user_nick,user_id`;
const POONG_TODAY_URL = (id, year, month) =>
  `https://static.poong.today/bj/detail/get?id=${encodeURIComponent(id)}&year=${year}&month=${month}`;

// "최근 3개월" as YYYY-MM-DD strings, matching how the SOOP station page itself filters the VOD tab
// (오늘 날짜 기준으로 정확히 3개월 전 같은 날짜부터).
function threeMonthDateRange(from = new Date()) {
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const text = await res.text();
    if (!text) return { ok: false, status: res.status, data: null };
    try {
      return { ok: true, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, data: null };
    }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: String(err && err.message ? err.message : err) };
  } finally {
    clearTimeout(timer);
  }
}

// Last N calendar months as {year, month} pairs, most recent first, e.g. N=3 for "최근 3개월".
function lastNMonths(n, from = new Date()) {
  const out = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1; // 1-12
  for (let i = 0; i < n; i++) {
    out.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

async function getSoopDashboard(id) {
  const { ok, data } = await fetchJson(SOOP_DASHBOARD_URL(id));
  if (!ok || !data || !data.station) return null;
  const totalBroadTimeSeconds = Number(data.station.totalBroadTime || 0);
  return {
    nickname: data.station.userNick || null,
    stationId: id,
    fanCnt: Number(data.upd && data.upd.fanCnt) || 0,
    totalBroadTimeHours: Math.round((totalBroadTimeSeconds / 3600) * 10) / 10,
    firstBroadDate: (data.station.firstBroadDate || "").split(" ")[0] || null,
    joinDate: (data.station.joinTime || "").split(" ")[0] || null,
    totalViewCnt: Number(data.upd && data.upd.totalViewCnt) || null,
    subscriberCnt: Number(data.subscription && data.subscription.total) || null,
  };
}

async function getVodCounts(id) {
  const { startDate, endDate } = threeMonthDateRange();
  const [reviewRes, normalRes] = await Promise.all([
    fetchJson(SOOP_VOD_URL(id, "review", startDate, endDate)),
    fetchJson(SOOP_VOD_URL(id, "normal", startDate, endDate)),
  ]);

  const replayCount =
    reviewRes.ok && reviewRes.data && reviewRes.data.meta && Number.isFinite(reviewRes.data.meta.totalItems)
      ? reviewRes.data.meta.totalItems
      : null;
  const vodCount =
    normalRes.ok && normalRes.data && normalRes.data.meta && Number.isFinite(normalRes.data.meta.totalItems)
      ? normalRes.data.meta.totalItems
      : null;

  if (replayCount === null && vodCount === null) return null;
  return { replayCount, vodCount, startDate, endDate };
}

async function getPoongTodayAvgConcurrent(id) {
  const months = lastNMonths(3);
  const results = await Promise.all(months.map((m) => fetchJson(POONG_TODAY_URL(id, m.year, m.month))));

  let sum = 0;
  let broadcastDays = 0;
  let anyOk = false;

  for (const r of results) {
    if (!r.ok || !r.data || !Array.isArray(r.data.d)) continue;
    anyOk = true;
    for (const day of r.data.d) {
      const m = Number(day.m || 0);
      if (m > 0) {
        sum += m;
        broadcastDays += 1;
      }
    }
  }

  if (!anyOk) return null; // BJ not tracked by poong.today, or all requests failed
  if (broadcastDays === 0) return { avgConcurrent: null, broadcastDays: 0 };

  return {
    avgConcurrent: Math.round((sum / broadcastDays) * 10) / 10,
    broadcastDays,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();

  if (!id) {
    return Response.json({ error: "id 쿼리 파라미터가 필요합니다. 예: /api/lookup?id=<SOOP 아이디>" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{2,20}$/.test(id)) {
    return Response.json({ error: "올바른 SOOP 아이디 형식이 아닙니다." }, { status: 400 });
  }

  const [dashboard, poong, vod] = await Promise.all([
    getSoopDashboard(id),
    getPoongTodayAvgConcurrent(id),
    getVodCounts(id),
  ]);

  if (!dashboard) {
    return Response.json(
      { error: `SOOP에서 "${id}" 채널을 찾을 수 없습니다. 아이디를 다시 확인해주세요.`, found: false },
      { status: 404 }
    );
  }

  const broadcastDays3mo = poong ? poong.broadcastDays : null;
  const replayRateEstimate =
    vod && vod.replayCount !== null && broadcastDays3mo
      ? Math.min(100, Math.round((vod.replayCount / broadcastDays3mo) * 100))
      : null;

  return Response.json({
    found: true,
    id,
    nickname: dashboard.nickname,
    fanCnt: dashboard.fanCnt,
    totalBroadTimeHours: dashboard.totalBroadTimeHours,
    firstBroadDate: dashboard.firstBroadDate,
    joinDate: dashboard.joinDate,
    concurrent: poong
      ? {
          avgConcurrent: poong.avgConcurrent,
          broadcastDays3mo: poong.broadcastDays,
          source: "poong.today (제3자, 일별 최고 동접으로 추정되는 값의 평균 — SOOP 공식 평균 동접과 다를 수 있음)",
        }
      : {
          avgConcurrent: null,
          broadcastDays3mo: null,
          source: "poong.today에서 데이터를 찾지 못했습니다 (등록되지 않은 채널이거나 활동이 적을 수 있음)",
        },
    vod: vod
      ? {
          vodCount: vod.vodCount,
          vodCountSource: "확정 · SOOP 공식 (방송국 > VOD 탭 > 업로드 VOD, 최근 3개월)",
          replayCount: vod.replayCount,
          replayRateEstimate,
          replayRateSource:
            replayRateEstimate !== null
              ? "추정 · SOOP 공식 다시보기 개수 ÷ poong.today 추정 방송일수 — 실제 SOOP 유지율(방송일 기준 %) 산출식과 다를 수 있음"
              : "다시보기 개수는 확인했지만 방송일수 추정치가 없어 유지율은 계산하지 못했습니다.",
        }
      : {
          vodCount: null,
          vodCountSource: "SOOP VOD API 조회에 실패했습니다. 직접 확인 후 입력해주세요.",
          replayCount: null,
          replayRateEstimate: null,
          replayRateSource: "SOOP VOD API 조회에 실패했습니다. 직접 확인 후 입력해주세요.",
        },
    sources: {
      soop: "https://api-channel.sooplive.com (SOOP 공식, 애청자 수·누적 방송시간·VOD 개수)",
      poongToday: "https://poong.today (제3자, 동시 시청자 추정치)",
    },
    fetchedAt: new Date().toISOString(),
  });
}
