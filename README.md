# 갓생살자

일정을 다시 짜주는 개인 비서 앱 프로토타입이에요. 전체 앱이 `index.html` 한 파일(순수
HTML/CSS/JS, 빌드 도구 없음)로 돼 있어서 브라우저에서 바로 열어도 되고, Capacitor로
감싸서 실제 Android(추후 iOS) 앱으로도 만들 수 있어요.

## 폴더 구성

- `index.html` — 앱 전체(유일한 소스예요). 이 파일을 고치면 브라우저 미리보기와
  Capacitor 앱 양쪽에 다 반영돼요.
- `server/` — 비서 채팅이 실제 LLM(Claude)과 대화하게 해주는 작은 백엔드. 배포 방법은
  `server/README.md` 참고.
- `capacitor.config.json`, `package.json`, `scripts/build.js` — Android 앱으로 감싸기
  위한 설정. 아래 "Android 앱으로 빌드하기" 참고.
- `NOTIFICATIONS.md`, `CALENDAR_SYNC.md` — 실제 기기 전환 시 남은 작업 체크리스트.

## 브라우저에서 바로 열어보기

`index.html`을 더블클릭하거나 브라우저로 열면 바로 실행돼요. 별도 설치·빌드가
필요 없어요.

## Android 앱으로 빌드하기

이 저장소엔 이미 Capacitor 설정이 갖춰져 있어요. 로컬 컴퓨터에서 아래 순서대로
하면 돼요(이 원격 세션엔 Android SDK/에뮬레이터가 없어서, 실제 기기 테스트는
컴퓨터에서 진행해야 해요).

### 0. 준비물

- [Node.js](https://nodejs.org) 18 이상
- [Android Studio](https://developer.android.com/studio) (JDK가 함께 설치돼요)
- 테스트할 Android 기기(USB 디버깅 켜기) 또는 Android Studio의 에뮬레이터

### 1. 저장소 받고 의존성 설치

```bash
git clone <이 저장소 주소>
cd live-god-life
npm install
```

### 2. Android 프로젝트 만들기 (최초 1회)

```bash
npx cap add android
```

`android/` 폴더가 새로 생겨요(이 폴더는 `www/index.html`에서 자동 생성되는 산출물이라
git에는 안 올라가요 — `.gitignore` 참고).

### 3. `index.html`을 고칠 때마다

```bash
npm run sync
```

`index.html`을 `www/`로 복사하고(`scripts/build.js`), `npx cap sync`로 Android
프로젝트 안의 웹 자산을 최신으로 맞춰줘요.

### 4. Android Studio에서 실행

```bash
npx cap open android
```

Android Studio가 열리면 연결된 기기나 에뮬레이터를 골라서 ▶(Run) 버튼을 누르면
앱이 설치·실행돼요. (`npm run android`으로 sync + open을 한 번에 해도 돼요.)

### 비서 LLM(AI 채팅) 테스트하기

1. `server/README.md`를 따라 자연어 해석 서버를 배포해요(Render.com 무료 요금제로
   가능해요).
2. 앱을 기기에서 실행한 뒤, **설정 → 비서**로 들어가서 "AI 서버 주소"와 "서버
   비밀키"를 입력하고 "연결 테스트"를 눌러 정상 연결을 확인해요.
3. 채팅(오른쪽 아래 💬 버튼)에서 자유 문장으로 말을 걸어보면 규칙 기반 대신 실제
   Claude가 이해해서 답해요. 예: "오늘 계획 좀 줄여줘", "병원 3시에 추가해줘".

이 서버 연결은 브라우저 프로토타입과 Android 앱에서 완전히 똑같이 동작해요 —
Capacitor는 같은 웹 코드를 네이티브 셸로 감싸기만 할 뿐, `fetch()`로 서버에 연결하는
로직 자체는 안 바뀌어요.

### 참고

- `capacitor.config.json`의 `appId`(`com.godsaeng.app`)는 임시값이에요. 실제로
  Play 스토어에 올리려면 본인 소유의 역방향 도메인(예: `com.본인이름.godsaeng`)으로
  바꿔야 해요.
- 알림(기상·취침·일정 알림을 앱이 꺼져 있어도 실제로 울리게 하는 것)과 캘린더
  양방향 동기화는 아직 준비 단계예요 — `NOTIFICATIONS.md`, `CALENDAR_SYNC.md`에
  뭐가 이미 돼 있고 뭐가 더 필요한지 정리해뒀어요.
