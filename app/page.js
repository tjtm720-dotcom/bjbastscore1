"use client";

import { useMemo, useState } from "react";
import {
  computeScore,
  checkEligibility,
  VIEWERS_ASC,
  FANS_ASC,
  HOURS_ASC,
} from "../lib/scoring";

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR");
}

function num(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

function StatusChip({ ok, okText, badText }) {
  return ok ? (
    <span className="chip good">✓ {okText}</span>
  ) : (
    <span className="chip bad">✕ {badText}</span>
  );
}

function NextHint({ value, table, unit }) {
  // local re-implementation avoided; import nextAnchor directly would be cleaner,
  // but computeScore already returns next-anchor info, so this component takes it as props instead.
  return null;
}

export default function Page() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState(null); // raw API response

  const [hoursTotal, setHoursTotal] = useState("");
  const [daysRecent, setDaysRecent] = useState("");
  const [fanCnt, setFanCnt] = useState("");
  const [suspended, setSuspended] = useState("no");

  const [viewers, setViewers] = useState("");
  const [fansScore, setFansScore] = useState("");
  const [hoursScore, setHoursScore] = useState("");

  const [vodCount, setVodCount] = useState("");
  const [replayRate, setReplayRate] = useState("");
  const [specialist, setSpecialist] = useState(false);
  const [warnGeneral, setWarnGeneral] = useState("");
  const [warnSame, setWarnSame] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setLookup(null);
    try {
      const res = await fetch(`/api/lookup?id=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setError(data.error || "조회에 실패했습니다.");
        setLoading(false);
        return;
      }
      setLookup(data);
      // auto-fill
      setHoursTotal(String(data.totalBroadTimeHours ?? ""));
      setHoursScore(String(data.totalBroadTimeHours ?? ""));
      setFanCnt(String(data.fanCnt ?? ""));
      setFansScore(String(data.fanCnt ?? ""));
      if (data.concurrent && data.concurrent.avgConcurrent != null) {
        setViewers(String(data.concurrent.avgConcurrent));
      }
      if (data.concurrent && data.concurrent.broadcastDays3mo != null) {
        setDaysRecent(String(data.concurrent.broadcastDays3mo));
      }
    } catch (err) {
      setError("네트워크 오류로 조회하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const elig = useMemo(
    () =>
      checkEligibility({
        hoursTotal: num(hoursTotal),
        daysRecent: num(daysRecent),
        fanCnt: num(fanCnt),
        suspended: suspended === "yes",
      }),
    [hoursTotal, daysRecent, fanCnt, suspended]
  );

  const score = useMemo(
    () =>
      computeScore({
        viewers: num(viewers),
        fans: num(fansScore),
        hours: num(hoursScore),
        vodCount: num(vodCount),
        replayRate: num(replayRate),
        specialist,
        warnGeneral: num(warnGeneral),
        warnSame: num(warnSame),
      }),
    [viewers, fansScore, hoursScore, vodCount, replayRate, specialist, warnGeneral, warnSame]
  );

  const gapViewers = (100 - score.scoreViewers) * 0.4;
  const gapFans = (100 - score.scoreFans) * 0.4;
  const gapHours = (100 - score.scoreHours) * 0.2;
  const priorityItems = [
    { name: "평균 동접자 수", gap: gapViewers, next: score.nextViewers, unit: "명" },
    { name: "애청자 수", gap: gapFans, next: score.nextFans, unit: "명" },
    { name: "누적 방송시간", gap: gapHours, next: score.nextHours, unit: "시간" },
  ].sort((a, b) => b.gap - a.gap);

  let statusLabel, statusClass, statusDesc;
  if (!elig.eligible) {
    statusClass = "bad";
    statusLabel = "신청 자격 미충족";
    statusDesc = "위 ①번 자격 요건을 먼저 채워야 정량평가 대상이 됩니다. 아래 점수는 참고용입니다.";
  } else if (score.final >= 75) {
    statusClass = "good";
    statusLabel = "합격권 (75점 이상)";
    statusDesc = "정량평가 컷라인을 통과했습니다. 최종 선발은 SOOP 운영진의 정성평가를 함께 반영합니다.";
  } else if (score.final >= 65) {
    statusClass = "warn";
    statusLabel = `합격 근접 (${(75 - score.final).toFixed(1)}점 부족)`;
    statusDesc = "정원 미달 시 상대평가로 근접자가 추가 선발될 수 있습니다.";
  } else {
    statusClass = "bad";
    statusLabel = `노력 필요 (${(75 - score.final).toFixed(1)}점 부족)`;
    statusDesc = "아래 우선순위 항목부터 집중해 보세요.";
  }

  const gaugePct = Math.min(100, score.final);

  return (
    <div className="wrap">
      <header className="top">
        <p className="eyebrow">SOOP 스트리머 성장 계산기</p>
        <h1>베스트 스트리머 계산기</h1>
        <p className="lede">
          SOOP 아이디를 검색하면 애청자 수·누적 방송시간·평균 동접(추정)을 자동으로 불러와 베스트
          스트리머 예상 점수(75점 컷)를 계산합니다. VOD·다시보기·경고 이력은 SOOP이 브라우저에서만
          렌더링하는 데이터라 직접 확인 후 입력해 주세요.
        </p>
        <div className="meta-row">
          <span className="meta-chip">기준일: 2026년 6월 완화된 신청 조건 반영</span>
          <span className="meta-chip">
            <a href="https://afevent2.sooplive.co.kr/app/star_bj/bestbj/order_info.php" target="_blank" rel="noopener noreferrer">
              SOOP 공식 안내 페이지 ↗
            </a>
          </span>
        </div>
      </header>

      <section id="search">
        <div className="card">
          <form className="search-row" onSubmit={handleLookup}>
            <input
              type="text"
              placeholder="SOOP 아이디를 입력하세요"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "조회 중..." : "조회"}
            </button>
          </form>
          {error && <div className="banner bad">{error}</div>}
          {lookup && (
            <>
              <div className="banner good">
                ✓ {lookup.nickname || lookup.id} ({lookup.id}) 채널 정보를 불러왔습니다. 아래 값은 자동으로
                채워졌으며 직접 수정할 수 있습니다.
              </div>
              <div className="fetched-grid">
                <div className="fetched-item">
                  <div className="lbl">애청자 수</div>
                  <div className="val">{fmt(lookup.fanCnt)}명</div>
                  <div className="src">확정 · SOOP 공식</div>
                </div>
                <div className="fetched-item">
                  <div className="lbl">누적 방송시간</div>
                  <div className="val">{fmt(lookup.totalBroadTimeHours)}h</div>
                  <div className="src">확정 · SOOP 공식</div>
                </div>
                <div className="fetched-item">
                  <div className="lbl">평균 동접(추정)</div>
                  <div className="val">
                    {lookup.concurrent && lookup.concurrent.avgConcurrent != null
                      ? `${fmt(lookup.concurrent.avgConcurrent)}명`
                      : "데이터 없음"}
                  </div>
                  <div className="src">추정 · poong.today (일별 최고 동접 평균)</div>
                </div>
                <div className="fetched-item">
                  <div className="lbl">최근 3개월 방송일수(추정)</div>
                  <div className="val">
                    {lookup.concurrent && lookup.concurrent.broadcastDays3mo != null
                      ? `${fmt(lookup.concurrent.broadcastDays3mo)}일`
                      : "-"}
                  </div>
                  <div className="src">추정 · poong.today 기록 기준</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section id="eligibility">
        <div className="sec-head">
          <h2>
            <span className="num">①</span> 신청 자격 요건
          </h2>
          <p>4가지를 모두 충족해야 신청 가능합니다 (2026년 6월 완화 기준: 500→100시간, 60→30일).</p>
        </div>
        <div className="card">
          <div className="elig-grid">
            <div className="elig-card">
              <label>누적 방송시간 (시간)</label>
              <input type="number" min="0" value={hoursTotal} onChange={(e) => setHoursTotal(e.target.value)} />
              <div className="req">기준: 100시간 이상 {lookup && <span className="auto-badge">· 자동 조회됨</span>}</div>
              <div className="status">
                <StatusChip ok={elig.okHours} okText="충족" badText="미충족" />
              </div>
            </div>
            <div className="elig-card">
              <label>최근 3개월 방송일수 (일)</label>
              <input type="number" min="0" max="92" value={daysRecent} onChange={(e) => setDaysRecent(e.target.value)} />
              <div className="req">기준: 30일 이상 {lookup && <span className="auto-badge">· 추정치(직접 확인 권장)</span>}</div>
              <div className="status">
                <StatusChip ok={elig.okDays} okText="충족" badText="미충족" />
              </div>
            </div>
            <div className="elig-card">
              <label>애청자 수 (명)</label>
              <input type="number" min="0" value={fanCnt} onChange={(e) => setFanCnt(e.target.value)} />
              <div className="req">기준: 500명 이상 {lookup && <span className="auto-badge">· 자동 조회됨</span>}</div>
              <div className="status">
                <StatusChip ok={elig.okFans} okText="충족" badText="미충족" />
              </div>
            </div>
            <div className="elig-card">
              <label>최근 3개월 방송정지 이력</label>
              <div className="radio-row">
                <label>
                  <input type="radio" name="suspend" checked={suspended === "no"} onChange={() => setSuspended("no")} /> 없음
                </label>
                <label>
                  <input type="radio" name="suspend" checked={suspended === "yes"} onChange={() => setSuspended("yes")} /> 있음
                </label>
              </div>
              <div className="req">공개 데이터로 확인 불가 · 직접 입력</div>
              <div className="status">
                <StatusChip ok={elig.okSuspend} okText="이력 없음" badText="이력 있음(신청 불가)" />
              </div>
            </div>
          </div>
          <div className={`banner ${elig.eligible ? "good" : "bad"}`}>
            {elig.eligible ? "✓ 신청 최소 자격 요건을 모두 충족했습니다." : "✕ 아직 충족하지 못한 항목이 있습니다."}
          </div>
        </div>
      </section>

      <section id="quant">
        <div className="sec-head">
          <h2>
            <span className="num">②</span> 정량평가 점수 (75점 이상 목표)
          </h2>
          <p>
            평균 동접(40%)·애청자(40%)·방송시간(20%) 가중합입니다. 검색 결과로 자동 채워진 값은 직접
            수정할 수 있습니다.
          </p>
        </div>
        <div className="quant-grid">
          <div className="card quant-card">
            <span className="weight">가중치 40%{lookup?.concurrent?.avgConcurrent != null && <span className="auto-badge"> · 추정치 자동입력</span>}</span>
            <h3>평균 동접자 수</h3>
            <input type="number" min="0" value={viewers} onChange={(e) => setViewers(e.target.value)} placeholder="명" />
            <div className="score-big">
              {score.scoreViewers.toFixed(1)}
              <span>점</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${score.scoreViewers}%` }} />
            </div>
            <div className="next-hint">
              {score.nextViewers ? (
                <>
                  다음 기준점까지 <b>{fmt(Math.max(0, score.nextViewers.value - num(viewers)))}명</b> 더 필요 → {score.nextViewers.score}점
                </>
              ) : (
                "이미 최고 구간(100점)입니다."
              )}
            </div>
          </div>
          <div className="card quant-card">
            <span className="weight">가중치 40%{lookup && <span className="auto-badge"> · 자동입력</span>}</span>
            <h3>애청자 수</h3>
            <input type="number" min="0" value={fansScore} onChange={(e) => setFansScore(e.target.value)} placeholder="명" />
            <div className="score-big">
              {score.scoreFans.toFixed(1)}
              <span>점</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${score.scoreFans}%` }} />
            </div>
            <div className="next-hint">
              {score.nextFans ? (
                <>
                  다음 기준점까지 <b>{fmt(Math.max(0, score.nextFans.value - num(fansScore)))}명</b> 더 필요 → {score.nextFans.score}점
                </>
              ) : (
                "이미 최고 구간(100점)입니다."
              )}
            </div>
          </div>
          <div className="card quant-card">
            <span className="weight">가중치 20%{lookup && <span className="auto-badge"> · 자동입력</span>}</span>
            <h3>누적 방송시간</h3>
            <input type="number" min="0" value={hoursScore} onChange={(e) => setHoursScore(e.target.value)} placeholder="시간" />
            <div className="score-big">
              {score.scoreHours.toFixed(1)}
              <span>점</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${score.scoreHours}%` }} />
            </div>
            <div className="next-hint">
              {score.nextHours ? (
                <>
                  다음 기준점까지 <b>{fmt(Math.max(0, score.nextHours.value - num(hoursScore)))}시간</b> 더 필요 → {score.nextHours.score}점
                </>
              ) : (
                "이미 최고 구간(100점)입니다."
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="bonus">
        <div className="sec-head">
          <h2>
            <span className="num">③</span> 가산점 · 감점 (직접 입력)
          </h2>
          <p>
            SOOP 방송국의 VOD 탭은 브라우저 렌더링 후에만 데이터가 나와 자동 조회하지 않습니다. 방송국 &gt;
            VOD 탭에서 직접 확인해 입력해 주세요.
          </p>
        </div>
        <div className="bonus-grid">
          <div className="card bonus-card">
            <label>최근 3개월 &quot;업로드 VOD&quot; 수 (개)</label>
            <input type="number" min="0" value={vodCount} onChange={(e) => setVodCount(e.target.value)} />
            <div className="sub">
              SOOP VOD 탭의 &quot;업로드 VOD&quot; 카테고리만 해당(다시보기·클립 제외). 1~3개 1점 · 4~6개
              2점 · 7~9개 3점 · 10~12개 4점 · 13개↑ 5점
            </div>
            <div className="result plus">+{score.bVod}점</div>
          </div>
          <div className="card bonus-card">
            <label>다시보기 유지율 (%)</label>
            <input type="number" min="0" max="100" value={replayRate} onChange={(e) => setReplayRate(e.target.value)} />
            <div className="sub">
              최근 3개월 방송일 중 &quot;다시보기&quot; 탭에 VOD가 남아있는 날의 비율. 70%↑ 1점 · 80%↑ 3점 ·
              90%↑ 5점
            </div>
            <div className="result plus">+{score.bReplay}점</div>
          </div>
          <div className="card bonus-card">
            <label>전문 스트리머 카테고리</label>
            <div className="checkbox-row">
              <input type="checkbox" checked={specialist} onChange={(e) => setSpecialist(e.target.checked)} /> 뮤즈 / 시그니처 /
              테크 / 프로게이머 / 커머스 / 스포츠 / VOD 우수활동자 중 해당
            </div>
            <div className="sub">한 가지만 충족해도 5점 가산</div>
            <div className="result plus">+{score.bSpecialist}점</div>
          </div>
          <div className="card bonus-card">
            <label>최근 3개월 일반 경고 건수</label>
            <input type="number" min="0" value={warnGeneral} onChange={(e) => setWarnGeneral(e.target.value)} />
            <div className="sub">2건부터 -10점, 초과 시 1건당 -10점 누적</div>
            <div className="result minus">-{score.dGen}점</div>
          </div>
          <div className="card bonus-card">
            <label>최근 3개월 동일 사유 반복 경고 건수</label>
            <input type="number" min="0" value={warnSame} onChange={(e) => setWarnSame(e.target.value)} />
            <div className="sub">1건부터 -20점 적용</div>
            <div className="result minus">-{score.dSame}점</div>
          </div>
        </div>
      </section>

      <section id="result">
        <div className="sec-head">
          <h2>
            <span className="num">④</span> 예상 최종 점수
          </h2>
        </div>
        <div className="card hero-card">
          <div className={`hero-status`} style={{ color: `var(--${statusClass})` }}>
            {statusLabel}
          </div>
          <p className="hero-desc">{statusDesc}</p>
          <div className="bar-track" style={{ height: 16, marginTop: 12, position: "relative" }}>
            <div
              className="bar-fill"
              style={{
                width: `${gaugePct}%`,
                background: `var(--${statusClass})`,
              }}
            />
            <div
              title="75점 컷"
              style={{
                position: "absolute",
                left: "75%",
                top: -4,
                bottom: -4,
                width: 3,
                background: "var(--gold)",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
            <span>0</span>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>75점 컷</span>
            <span>100</span>
          </div>

          <div className="breakdown">
            <div className="breakdown-row">
              <span>평균 동접 (40%)</span>
              <b>{score.wViewers.toFixed(1)}</b>
            </div>
            <div className="breakdown-row">
              <span>애청자 (40%)</span>
              <b>{score.wFans.toFixed(1)}</b>
            </div>
            <div className="breakdown-row">
              <span>방송시간 (20%)</span>
              <b>{score.wHours.toFixed(1)}</b>
            </div>
            <div className="breakdown-row">
              <span>정량평가 소계</span>
              <b>{score.subtotal.toFixed(1)}</b>
            </div>
            <div className="breakdown-row">
              <span>가산점</span>
              <b>+{score.totalBonus.toFixed(1)}</b>
            </div>
            <div className="breakdown-row">
              <span>감점</span>
              <b>-{score.totalDeduct.toFixed(1)}</b>
            </div>
            <div className="breakdown-row total">
              <span>최종 예상 점수</span>
              <b>{score.final.toFixed(1)}</b>
            </div>
          </div>

          <div className="priority-box">
            <span className="eyebrow2">가장 효율적인 개선 항목</span>
            {score.totalDeduct > 0 ? (
              <>
                경고 이력으로 <b>-{score.totalDeduct.toFixed(0)}점</b>이 감점되고 있습니다. 다른 지표보다 경고 사유 해소가
                가장 빠른 개선입니다.
              </>
            ) : priorityItems[0].gap <= 0.01 ? (
              "세 지표 모두 만점(100점) 구간입니다. 가산점(VOD·다시보기)을 채워보세요."
            ) : (
              <>
                <b>{priorityItems[0].name}</b> 지표의 개선 여력이 가장 큽니다(최고 구간까지 올리면 최대 +
                {priorityItems[0].gap.toFixed(1)}점).
                {priorityItems[0].next && (
                  <>
                    {" "}
                    다음 기준점은 {fmt(priorityItems[0].next.value)}
                    {priorityItems[0].unit}({priorityItems[0].next.score}점)입니다.
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section id="selection-info">
        <div className="sec-head">
          <h2>
            <span className="num">⑤</span> 선발 방식 · 유지 조건
          </h2>
        </div>
        <div className="info-box">
          <h3>선발 방식</h3>
          <ul>
            <li>
              <span className="confidence fact">확정</span> 최종점수 75점 이상 획득자 중 최소 40명~최대 100명 선발
            </li>
            <li>
              <span className="confidence ref">참고</span> 75점 이상 인원이 40명 미만이면, 75점에 근접한 순으로 상대평가를
              진행해 정원(최소 40명)을 채우는 것으로 알려져 있습니다.
            </li>
          </ul>
          <h3 style={{ marginTop: 14 }}>선정 후 유지 조건</h3>
          <ul>
            <li>
              <span className="confidence fact">확정</span> 월 최소 5일 이상, 15시간 이상 방송을 유지해야 자격이 유지됩니다.
            </li>
          </ul>
        </div>
      </section>

      <footer>
        <h3 style={{ fontSize: "0.9rem", marginBottom: 8 }}>데이터 출처 및 신뢰도 표기</h3>
        <ul>
          <li>
            <span className="confidence fact">확정</span> 신청 최소 조건과 75점 컷·40~100명 선발:{" "}
            <a href="https://afevent2.sooplive.co.kr/app/star_bj/bestbj/order_info.php" target="_blank" rel="noopener noreferrer">
              SOOP 공식 안내 페이지
            </a>
          </li>
          <li>
            <span className="confidence fact">확정</span> 애청자 수·누적 방송시간: SOOP 공식 채널 API(api-channel.sooplive.com)에서 실시간 조회
          </li>
          <li>
            <span className="confidence ref">참고</span> 평균 동접·최근 3개월 방송일수: poong.today의 일별 기록을 바탕으로 이 사이트가 자체 계산한 추정치
          </li>
          <li>
            <span className="confidence ref">참고</span> 구간별 점수표·가산점 배점은 SOOP이 게시한 점수표 자료를 근거로 반영했으며, 세부 수치가 개편되었을 수 있습니다.
          </li>
        </ul>
        <p>
          이 계산기는 참고용 추정치이며, 실제 심사는 SOOP 운영진의 정성평가와 내부 기준에 따라 달라질 수
          있습니다.
        </p>
      </footer>
    </div>
  );
}
