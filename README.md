# 갓생살자

일정을 다시 짜주는 개인 비서 앱 프로토타입이에요. 전체 앱이 `index.html` 한 파일(순수
HTML/CSS/JS, 빌드 도구 없음)로 돼 있어서 브라우저에서 바로 열어도 되고, Capacitor로
감싸서 실제 Android(추후 iOS) 앱으로도 만들 수 있어요.

## 폴더 구성

- `index.html` — 앱 전체(유일한 소스예요). 이 파일을 고치면 브라우저 미리보기와
  Capacitor 앱 양쪽에 다 반영돼요.
- `server/` — 비서 채팅이 실제 LLM(Claude)과 대화하게 해주는 작은 백엔드. 배포 방법은
  `server/README.md` 참고.
- `capacitor.config.json`, `package.json`, `scripts/build.js`, `scripts/build-apk.js` —
  Android 앱으로 감싸기 위한 설정. 아래 "Android 앱으로 빌드하기" 참고.
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

**중요**: 2~4단계 중 Android Studio로 프로젝트를 최소 한 번은 열어봐야 해요. 그래야
Android Studio가 `android/local.properties`에 SDK 경로(`sdk.dir`)를 자동으로 채워주는데,
이게 없으면 아래 5단계처럼 터미널만으로 빌드할 때 "SDK를 못 찾겠다"는 에러가 나요.

### 5. 설치 파일(APK)만 바로 받고 싶을 때

Android Studio를 매번 열지 않고, 터미널 명령 하나로 설치 가능한 **디버그 APK**를
바로 뽑아낼 수 있어요(2~4단계로 한 번 열어본 뒤부터 사용 가능):

```bash
npm run apk
```

`index.html`을 `www/`에 동기화하고, Gradle로 디버그 APK를 빌드해요(처음 한 번은
Gradle이 관련 파일을 내려받느라 몇 분 걸릴 수 있어요). 끝나면 아래 경로에 설치 파일이
생겨요:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

이 파일은 안드로이드 기본 "디버그 서명"으로 이미 서명돼 있어서, 추가 서명 없이 바로
기기에 설치해서 테스트할 수 있어요(플레이 스토어에는 이 방식으로 못 올려요 — 스토어
출시는 별도 릴리즈 서명이 필요한 나중 단계예요). 설치 방법은 둘 중 편한 쪽으로:

- **USB로 연결한 기기에 바로 설치**: 기기에서 USB 디버깅을 켠 뒤
  `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- **파일로 옮겨서 설치**: 위 `app-debug.apk` 파일을 카카오톡/이메일/USB 등으로 폰에
  옮긴 뒤 파일을 눌러서 설치해요(안드로이드가 "출처를 알 수 없는 앱" 설치를 허용할지
  물어보면 허용해주면 돼요).

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
