// index.html -> www/ 동기화 후, Android 프로젝트의 "디버그 APK"를 빌드해요. 디버그 APK는
// 안드로이드 빌드 도구가 자동으로 만들어주는 디버그 키로 서명되기 때문에 별도 서명 절차
// 없이 바로 기기에 설치해서 테스트할 수 있어요(플레이 스토어에 올리려면 따로 릴리즈
// 서명이 필요한데, 그건 이 스크립트가 하는 일이 아니에요 — 테스트용 APK 전용이에요).
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');

if (!fs.existsSync(androidDir)) {
  console.error('android/ 폴더가 없어요. 먼저 `npx cap add android`를 한 번 실행해주세요.');
  process.exit(1);
}

// JAVA_HOME이 비어 있으면 Android Studio에 내장된 JDK(jbr)를 찾아서 Gradle에 넘겨줘요.
// 환경변수를 방금 설정해서 아직 새 터미널을 안 열었을 때도 빌드가 되게 하려는 거예요.
const env = { ...process.env };
if (!env.JAVA_HOME || !fs.existsSync(env.JAVA_HOME)) {
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
      ]
    : ['/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr'];
  const jbr = candidates.find((dir) => fs.existsSync(path.join(dir, 'bin')));
  if (jbr) {
    env.JAVA_HOME = jbr;
    console.log('JAVA_HOME이 없어서 Android Studio 내장 JDK를 써요: ' + jbr);
  }
}

console.log('1/2) index.html -> www/ 동기화 중...');
execSync('npx cap sync android', { cwd: root, stdio: 'inherit' });

console.log('2/2) 디버그 APK 빌드 중 (Gradle) — 처음 실행하면 몇 분 걸릴 수 있어요...');
// 전체 경로로 불러요 — Windows에서 NoDefaultCurrentDirectoryInExePath가 켜져 있으면 cmd가
// 현재 폴더의 gradlew.bat을 찾지 못하거든요.
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const result = spawnSync(`"${gradlew}"`, ['assembleDebug'], { cwd: androidDir, stdio: 'inherit', shell: true, env });

if (result.status !== 0) {
  console.error(
    '\n빌드에 실패했어요. 아래를 확인해보세요:\n' +
    '  1) Android Studio를 한 번 설치·실행했고, 이 프로젝트(android/ 폴더)를 한 번 열어서\n' +
    '     SDK 컴포넌트를 내려받은 적이 있는지 (Android Studio가 android/local.properties에\n' +
    '     sdk.dir을 자동으로 채워줘요 — 이게 없으면 커맨드라인 빌드가 SDK 위치를 못 찾아요)\n' +
    '  2) ANDROID_HOME 환경변수가 SDK 설치 경로를 가리키는지\n' +
    '  3) JDK 17 이상이 설치돼 있는지 (Android Studio에 내장된 JDK를 써도 돼요)\n'
  );
  process.exit(result.status || 1);
}

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (fs.existsSync(apkPath)) {
  console.log('\n✅ APK 생성 완료: ' + apkPath);
  console.log('이 파일을 안드로이드 기기로 옮겨서 설치하면 바로 테스트할 수 있어요.');
  console.log('USB로 연결돼 있고 adb가 있다면: adb install -r "' + apkPath + '"');
} else {
  console.warn('빌드는 끝난 것 같은데 APK 파일을 못 찾았어요: ' + apkPath);
}
