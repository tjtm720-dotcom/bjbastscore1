// Shared scoring logic for the SOOP "베스트 스트리머" calculator.
// Mirrors the standalone calculator (claude.ai artifact) so both stay consistent.
//
// Confidence notes (also surfaced in the UI):
//   - Entry requirements (100h / 30 days / 500 fans / no suspension) and the 75-point cut,
//     40~100 selected per round: 확정 (SOOP's own official "베스트 스트리머" info page).
//   - The tier tables below (per-bracket scores for concurrent viewers / fans / hours, and the
//     bonus tables for VOD / replay-retention / specialist category): 참고 — reconstructed from a
//     score table the user supplied (a screenshot of SOOP's own published table), not an SOOP API,
//     so a future SOOP policy change could make this stale.

export const TABLE_VIEWERS_DESC = [
  [1000, 100], [750, 98], [500, 96], [450, 94], [400, 92], [350, 90], [300, 88], [250, 86],
  [200, 84], [160, 82], [130, 80], [100, 78], [90, 76], [80, 74], [70, 72], [60, 70],
  [50, 68], [40, 66], [30, 64], [20, 62], [10, 60],
];

export const TABLE_FANS_DESC = [
  [50000, 100], [40000, 98], [30000, 96], [20000, 94], [10000, 92], [9000, 90], [8000, 88],
  [7000, 86], [6000, 84], [5600, 82], [5200, 80], [4800, 78], [4400, 76], [4000, 74],
  [3600, 72], [3200, 70], [2800, 68], [2400, 66], [2000, 64], [1500, 62], [1000, 60],
];

export const TABLE_HOURS_DESC = [
  [10000, 100], [9500, 98], [9000, 96], [8500, 94], [8000, 92], [7500, 90], [7000, 88],
  [6500, 86], [6000, 84], [5500, 82], [5000, 80], [4500, 78], [4000, 76], [3500, 74],
  [3000, 72], [2600, 70], [2200, 68], [1800, 66], [1400, 64], [1000, 62], [500, 60],
];

export const VIEWERS_ASC = TABLE_VIEWERS_DESC.slice().reverse();
export const FANS_ASC = TABLE_FANS_DESC.slice().reverse();
export const HOURS_ASC = TABLE_HOURS_DESC.slice().reverse();

// Below the lowest named bracket -> flat 50. At/above the top bracket -> flat 100.
// Between two consecutive brackets -> STEP function, no interpolation: the score holds at the
// last bracket actually reached and only jumps (in 2-point increments) once the value hits the
// next named threshold. Confirmed by the user: 정량평가는 60점부터 2씩 올라가는 계단식이며
// 소수점(보간) 계산을 하지 않음.
export function interpScore(value, ascTable) {
  const v = value || 0;
  const n = ascTable.length;
  if (v < ascTable[0][0]) return 50;
  let score = ascTable[0][1];
  for (let i = 0; i < n; i++) {
    if (v >= ascTable[i][0]) {
      score = ascTable[i][1];
    } else {
      break;
    }
  }
  return score;
}

export function nextAnchor(value, ascTable) {
  const v = value || 0;
  const n = ascTable.length;
  if (v >= ascTable[n - 1][0]) return null;
  for (let i = 0; i < n; i++) {
    if (ascTable[i][0] > v) return { value: ascTable[i][0], score: ascTable[i][1] };
  }
  return null;
}

export function bonusVod(n) {
  const c = n || 0;
  if (c >= 13) return 5;
  if (c >= 10) return 4;
  if (c >= 7) return 3;
  if (c >= 4) return 2;
  if (c >= 1) return 1;
  return 0;
}

export function bonusReplay(pct) {
  const p = pct || 0;
  if (p >= 90) return 5;
  if (p >= 80) return 3;
  if (p >= 70) return 1;
  return 0;
}

export function deductGeneralWarnings(n) {
  const c = n || 0;
  return c >= 2 ? (c - 1) * 10 : 0;
}

export function deductSameWarnings(n) {
  const c = n || 0;
  return c >= 1 ? c * 20 : 0;
}

export function computeScore(input) {
  const {
    viewers = 0,
    fans = 0,
    hours = 0,
    vodCount = 0,
    replayRate = 0,
    specialist = false,
    warnGeneral = 0,
    warnSame = 0,
  } = input;

  const scoreViewers = interpScore(viewers, VIEWERS_ASC);
  const scoreFans = interpScore(fans, FANS_ASC);
  const scoreHours = interpScore(hours, HOURS_ASC);

  const wViewers = scoreViewers * 0.4;
  const wFans = scoreFans * 0.4;
  const wHours = scoreHours * 0.2;
  const subtotal = wViewers + wFans + wHours;

  const bVod = bonusVod(vodCount);
  const bReplay = bonusReplay(replayRate);
  const bSpecialist = specialist ? 5 : 0;
  const totalBonus = bVod + bReplay + bSpecialist;

  const dGen = deductGeneralWarnings(warnGeneral);
  const dSame = deductSameWarnings(warnSame);
  const totalDeduct = dGen + dSame;

  const final = subtotal + totalBonus - totalDeduct;

  return {
    scoreViewers, scoreFans, scoreHours,
    wViewers, wFans, wHours, subtotal,
    bVod, bReplay, bSpecialist, totalBonus,
    dGen, dSame, totalDeduct,
    final: Math.max(0, final),
    finalRaw: final,
    nextViewers: nextAnchor(viewers, VIEWERS_ASC),
    nextFans: nextAnchor(fans, FANS_ASC),
    nextHours: nextAnchor(hours, HOURS_ASC),
  };
}

export function checkEligibility({ hoursTotal = 0, daysRecent = 0, fanCnt = 0, suspended = false }) {
  const okHours = hoursTotal >= 100;
  const okDays = daysRecent >= 30;
  const okFans = fanCnt >= 500;
  const okSuspend = !suspended;
  return {
    okHours, okDays, okFans, okSuspend,
    eligible: okHours && okDays && okFans && okSuspend,
  };
}
