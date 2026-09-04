# 베스트 스트리머 계산기 (SOOP Best Streamer Calculator)

SOOP(舊 AfreecaTV) 아이디를 검색하면 애청자 수·누적 방송시간·평균 동접(추정)을 자동으로 불러와
베스트 스트리머 정량평가 예상 점수(75점 컷)를 계산하는 Next.js 앱입니다.

## 무엇이 자동이고 무엇이 수동인가

| 항목 | 방식 | 출처 |
| --- | --- | --- |
| 애청자 수 | 자동 | SOOP 공식 채널 API (`api-channel.sooplive.com`) |
| 누적 방송시간 | 자동 | SOOP 공식 채널 API |
| 평균 동접(추정) / 최근 3개월 방송일수(추정) | 자동 | poong.today 일별 기록 기반 추정치 (제3자, SOOP 공식 평균 동접과 다를 수 있음) |
| 업로드 VOD 개수 / 다시보기 유지율 / 전문 스트리머 여부 / 경고 이력 | **수동 입력** | SOOP은 이 데이터를 브라우저에서만(JS 렌더링 후) 보여줘서 서버에서 직접 가져올 수 없습니다 |

## 로컬에서 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

## Vercel 배포 방법 (GitHub 연동)

1. **GitHub 저장소 만들기**
   - GitHub에서 새 저장소를 만듭니다 (예: `soop-best-streamer`). Public/Private 무관.
   - 이 폴더에서 아래 명령 실행 (저장소 URL은 본인 것으로 교체):
     ```bash
     git remote add origin https://github.com/<본인계정>/soop-best-streamer.git
     git branch -M main
     git push -u origin main
     ```

2. **Vercel에 연결**
   - https://vercel.com 에 로그인 → "Add New..." → "Project" → 방금 만든 GitHub 저장소 선택 → Import
   - Framework Preset은 Next.js로 자동 인식됩니다. 별도 환경변수 설정 없이 바로 "Deploy" 누르면 됩니다.
   - 배포가 끝나면 `https://<프로젝트명>.vercel.app` 주소가 생깁니다.

3. **배포 후 확인할 것**
   - 배포된 사이트에서 알고 있는 SOOP 아이디로 검색해서 애청자/방송시간/동접 값이 정상적으로 채워지는지 확인하세요.
   - 이 저장소는 샌드박스 환경의 네트워크 제한 때문에 `/api/lookup` 라이브 호출을 로컬에서 검증하지 못했습니다. Vercel은 일반적인 아웃바운드 네트워크를 허용하므로 정상 동작이 기대되지만, 배포 후 반드시 한 번 실제로 테스트해 주세요.
   - poong.today에 등록되지 않은 채널(주로 활동이 적은 채널)은 평균 동접 값이 비어서 나올 수 있습니다. 이 경우 직접 입력하면 됩니다.

## 프로젝트 구조

```
app/
  api/lookup/route.js   # 서버리스 API: SOOP 대시보드 API + poong.today API 호출
  page.js                # 메인 UI (검색창 + 점수 계산 대시보드)
  layout.js               # 루트 레이아웃, 폰트 로딩
  globals.css             # 디자인 토큰 및 컴포넌트 스타일 (라이트/다크 테마)
lib/
  scoring.js              # 점수 계산 로직 (구간 테이블 + 연속 선형보간)
```

## 점수 계산 방식에 대한 신뢰도 표기

- **확정**: 신청 최소 조건(누적 100시간·최근 3개월 30일·애청자 500명·정지 이력 없음)과 75점 컷, 40~100명 선발 — SOOP 공식 안내 페이지 기준.
- **참고**: 구간별 점수표(평균 동접/애청자/방송시간)와 가산점 배점(VOD/다시보기/전문 스트리머)은 사용자가 제공한 SOOP 공식 점수표 캡처를 근거로 구현했습니다. SOOP이 기준을 개편하면 `lib/scoring.js`의 테이블을 갱신해야 합니다.
- **추정**: 평균 동접·최근 3개월 방송일수는 poong.today의 일별 데이터(하루 최고 동접으로 추정되는 값)를 평균한 것으로, SOOP이 실제 심사에 쓰는 평균 동접 산출 방식과 다를 수 있습니다.

## 라이선스

개인 사용 목적으로 제작되었습니다.
