// index.html이 이 앱의 유일한 소스예요(Claude 아티팩트로도 그대로 배포돼요). Capacitor는
// webDir(www/) 안의 정적 파일을 그대로 네이티브 프로젝트 안에 복사해서 쓰기 때문에, 앱을
// 빌드하기 전에 이 스크립트로 index.html을 www/ 안에 복사해둬요. 별도 번들러(webpack 등)는
// 필요 없어요 — 이 앱은 처음부터 빌드 과정 없이 브라우저에서 바로 열리는 순수 HTML/JS
// 한 파일이라서요.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'index.html');
const outDir = path.join(root, 'www');
const dest = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('index.html → www/index.html 복사 완료');
