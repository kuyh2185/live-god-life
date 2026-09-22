# 일정 알림 — 실제 앱(Capacitor) 전환 체크리스트

`index.html`에는 이미 실제 OS 알림(Capacitor Local Notifications)을 위한 배선이 들어가 있어요.
지금은 브라우저 프로토타입이라 전부 조용히 아무 일도 안 하지만(`nativeNotifPlugin()`이 항상
`null`), 앱을 Capacitor로 감싸고 아래 설치/설정을 마치면 코드를 더 고치지 않아도 그대로
작동해요.

## 이미 준비된 것 (index.html)

- `isNativeApp()` / `nativeNotifPlugin()` — Capacitor 네이티브 환경인지, 플러그인이
  있는지 감지해요.
- `reminderNotifId(entryId)` — 문자열 entryId를 알림에 필요한 정수 id로 변환해요.
- `syncNativeReminder(row, dateKey)` — 일정 하나를 실제 OS 알림으로 예약(기존 예약은
  먼저 취소하고 새로 잡음)해요. `row.reminderMinutes`가 없거나 이미 지난 시각이면 예약 안 함.
- `cancelNativeReminder(entryId)` — 알림 하나를 취소해요.
- `syncAllNativeRemindersForToday()` — 오늘 시간표 전체를 다시 예약해요. 일정 추가/수정/
  삭제, 반복 일정 잠시 쉬기, 완료·건너뜀 기록 시 자동으로 호출돼요(각 함수 안에 이미 연결됨).
- `setupNativeNotifications()` — 앱 시작 시 한 번: 알림 권한 요청 + 안드로이드 알림
  채널(`godsaeng-reminders`) 생성 + 오늘 알림 전체 예약.
- 브라우저 시뮬레이션(`checkReminders`, 60초 타이머로 화면 안에서 띠링+배너)은 네이티브
  환경에서는 자동으로 꺼져요(`isNativeApp()`이면 건너뜀) — 안 그러면 앱이 켜져 있는 동안
  OS 알림과 화면 알림이 중복으로 울려요.

## 설치·설정 순서

1. **플러그인 설치**
   ```bash
   npm install @capacitor/local-notifications
   npx cap sync
   ```

2. **Android**
   - Android 13(API 33) 이상은 알림 권한이 런타임 권한이에요 — `requestPermissions()`
     호출로 이미 처리돼 있어요(별도 매니페스트 권한 선언은 플러그인이 자동으로 추가해요).
   - 정확한 시각에 울리려면(±수 분 오차 없이) `android/app/src/main/AndroidManifest.xml`에
     `SCHEDULE_EXACT_ALARM` 권한이 필요할 수 있어요(안드로이드 12+). 필요 시 추가하고,
     Google Play 정책상 "정확한 알람이 꼭 필요한 이유"를 스토어 등록 시 소명해야 해요.
   - 알림 채널은 `setupNativeNotifications()`에서 자동 생성돼요.

3. **iOS**
   - `requestPermissions()` 호출 하나로 Android/iOS 둘 다 처리돼요.
   - Xcode에서 Push/Local Notifications 관련 별도 capability 설정은 필요 없어요(로컬
     알림은 원격 푸시와 달라서 인증서/APNs 설정이 필요 없음).

4. **앱 시작 시 호출 확인**
   - `setupNativeNotifications()`는 이미 `render()` 호출 직전에 자동으로 실행돼요.
     별도로 호출할 필요 없어요.

## 아직 안 된 것 (실제 앱 단계에서 결정 필요)

- **반복 일정의 여러 날짜 예약**: `syncAllNativeRemindersForToday()`는 이름 그대로
  "오늘" 시간표만 계산해서 예약해요. 실제 앱에서는 사용자가 며칠씩 앱을 안 열어도 알림이
  와야 하니, 예를 들어 "앱을 열 때마다 + 매일 자정 무렵(백그라운드 태스크)에 향후 7일치를
  다시 예약"하는 로직이 필요해요. `@capacitor/background-runner`나 네이티브 스케줄러
  (Android WorkManager, iOS BGTaskScheduler)를 붙이는 걸 권장해요.
- **이어폰 연결 자동 감지**: 지금 설정의 "이어폰 연결 시뮬레이션" 토글은 브라우저에서
  감지할 방법이 없어서 만든 수동 토글이에요. 실제 기기에서는:
  - Android: `AudioManager.isWiredHeadsetOn()` / `isBluetoothA2dpOn()` (또는
    `AudioDeviceInfo` API)
  - iOS: `AVAudioSession.sharedInstance().currentRoute.outputs`
  둘 다 커스텀 네이티브 플러그인(또는 커뮤니티 플러그인)이 필요해요 — 웹 표준 API로는
  안정적으로 가져올 수 없어요. 이게 준비되면 설정의 수동 토글을 실제 감지값으로
  바꾸기만 하면 돼요(`state.settings.voice.headphonesConnected`를 그 값으로 채우면 끝).
- **알림을 눌렀을 때 앱 내 이동**: 지금은 알림을 탭하면 "오늘" 탭으로 이동만 해요.
  네이티브 알림을 탭했을 때 해당 일정 상세 시트를 바로 여는 것까지 하려면
  `LocalNotifications.addListener('localNotificationActionPerformed', ...)`로
  알림의 `entryId`(알림 예약 시 `extra` 필드에 같이 넣어두면 돼요)를 받아 `openSheet`
  액션을 호출하도록 연결하면 돼요.
