# 캘린더 양방향 동기화 — 실제 앱 구현 체크리스트

온보딩에서 "캘린더 연동하고 시작"을 고르면 `state.settings.calendarSync = {enabled:true,
provider:'google'}`가 켜지고, 일정을 추가·수정·삭제할 때마다 `pushEventToCalendar(...)`가
호출되도록 이미 배선해뒀어요. 지금은 `calendarSyncPlugin()`이 항상 `null`이라 조용히
아무 일도 안 해요 — 아래 작업을 마치면 코드를 더 고치지 않아도 그대로 작동해요.

## 왜 이건 프로토타입에서 직접 못 만드나요

Google Calendar 실연동은 OAuth 인증 + 액세스 토큰을 안전하게 보관할 백엔드가 필요해요.
클라이언트(브라우저/앱)에만 있는 정적 페이지에서는:
- OAuth 클라이언트 시크릿을 안전하게 둘 곳이 없고,
- 이미 만들어둔 `server/`(자연어 해석용 Node 서버)처럼 실제 배포된 서버가 있어야
  Google이 발급한 인증 코드를 액세스 토큰으로 교환할 수 있어요.

그래서 이건 "설정 몇 개 추가"로 끝나지 않고 `server/`를 확장하는 작업이 함께 필요해요.

## 이미 준비된 것 (index.html)

- `state.settings.calendarSync = {enabled, provider}` — 사용자의 연동 의도를 저장해요.
- 온보딩 3단계 "캘린더 연동하고 시작" 버튼(`onboardingConnectCalendar`) — 예시 데이터를
  비우고 `calendarSync.enabled`를 켜요. 실제로는 여기서 OAuth 동의 화면을 띄워야 해요.
- 설정 → 외부 연동의 "Google 캘린더 자동 동기화" 토글 — 언제든 켜고 끌 수 있어요.
- `calendarSyncPlugin()` — `window.Capacitor.Plugins.CalendarSync`가 있는지 감지해요.
- `pushEventToCalendar(kind, action, payload)` — `kind`는 `'recurring'|'adhoc'`, `action`은
  `'create'|'update'|'delete'`예요. `addRecurringEvent`/`updateRecurringEvent`/
  `deleteRecurringEvent`/`addAdhocEntry`/`updateAdhocEntry`/`deleteAdhocEntry` 여섯
  곳 모두에서 이미 호출하고 있어요 — 새 연동 지점을 추가할 필요 없이, 저 플러그인만
  실제로 만들면 갓생살자 → 캘린더 방향은 바로 동작해요.

## 실제로 만들어야 할 것

### 1. 서버 쪽 (`server/`를 확장)

- Google OAuth 2.0 "Authorization Code" 플로우 처리 엔드포인트 2개:
  - `GET /auth/google/start` — Google 동의 화면으로 리다이렉트
  - `GET /auth/google/callback` — 인증 코드를 액세스/리프레시 토큰으로 교환하고,
    사용자별로 안전하게 저장(현재 서버는 무상태(stateless)라 최소한의 토큰 저장소가
    새로 필요해요 — 사용자가 태현님 한 분이면 파일 하나에 암호화해서 저장하는 정도로도
    충분해요)
- `POST /calendar/push` — 앱에서 `pushEventToCalendar`가 보낸 일정을 받아 Google
  Calendar API(`events.insert`/`events.update`/`events.delete`)로 반영
- `GET /calendar/pull` 또는 Google의 push notification(webhook)을 받는 엔드포인트 —
  캘린더 → 앱 방향(사용자가 Google Calendar 앱에서 직접 추가/수정한 일정을 갓생살자에도
  반영). 간단한 v1이라면 webhook 대신 몇 분마다 폴링(`events.list`의
  `updatedMin`/`syncToken` 사용)으로 시작해도 괜찮아요.

### 2. 앱 쪽 (`index.html`)

- `calendarSyncPlugin()`이 감지하는 `window.Capacitor.Plugins.CalendarSync`를 실제로
  만들어요(작은 커스텀 Capacitor 플러그인, 또는 그냥 위 서버 엔드포인트를 직접
  `fetch()`하는 JS 함수로 바꿔도 돼요 — 네이티브 플러그인일 필요는 없고, 지금
  `calendarSyncPlugin()` 자리를 실제 fetch 호출로 교체하기만 하면 돼요).
- 캘린더 → 앱 방향 반영: 주기적으로(예: 60초 알림 체크 타이머에 얹어서) `GET
  /calendar/pull`을 호출해 바뀐 일정을 가져와 `addAdhocEntry`/`updateAdhocEntry`/
  `deleteAdhocEntry`로 반영해요.

### 3. 로컬 ↔ Google 이벤트 필드 매핑

| 갓생살자 필드 | Google Calendar 필드 |
|---|---|
| `label` | `summary` |
| `memo` | `description` |
| `time` + `duration` (adhoc: `dateKey`) | `start.dateTime` / `end.dateTime` |
| `isFixed` | 매핑할 대응 필드 없음 — 로컬 전용 개념으로 남겨둬요 |
| 로컬 `id` | Google이 만든 `event.id`를 함께 저장해서 다음 업데이트/삭제 때 매칭해요
  (지금 로컬 데이터에는 이 필드가 없어서, 실제 구현 시 `googleEventId` 같은 필드를
  이벤트에 추가해야 해요) |

### 4. 충돌 처리

v1은 단순하게 **마지막에 반영된 쪽이 이긴다(last-write-wins)** 로 시작하는 걸 권장해요.
양쪽에서 동시에 같은 일정을 고치는 경우는 드물고, 잘못돼도 사용자가 금방 알아채고 다시
고칠 수 있는 앱이라 정교한 충돌 해결 로직 없이도 실용적이에요.

### 5. 반복 일정(`kind:'recurring'`)

Google Calendar에는 RRULE 기반의 반복 일정이 있어요. 갓생살자의 반복 일정(`days` 배열,
요일 기준)을 Google의 RRULE(`FREQ=WEEKLY;BYDAY=...`)로 변환하는 작업이 필요해요 — 이
프로토타입의 `pushEventToCalendar('recurring', ...)` 호출은 이미 연결돼 있지만, 실제
RRULE 변환 로직은 서버 쪽에서 새로 작성해야 해요.
