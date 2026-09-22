# 갓생살자 자연어 서버 — 배포 가이드

이 폴더는 앱의 "자연어로 말하면 알아듣는" 기능을 위한 아주 작은 서버예요.
서버가 하는 일은 한 가지뿐이에요: 앱이 보낸 문장을 Claude에게 물어보고,
구조화된 명령(JSON)으로 바꿔서 돌려줘요. 실제 일정 변경은 항상 앱에서,
사용자 확인을 거친 뒤에만 일어나요.

무료로 운영 가능한 **Render.com**을 기준으로 안내할게요(신용카드 없이 가입
가능, 무료 요금제는 15분간 요청이 없으면 잠들었다가 다음 요청에서 몇십초
안에 다시 깨어나요 — 개인용으로 충분해요).

## 0. 미리 준비할 것

1. **Anthropic API 키** — https://console.anthropic.com 에 가입 → 왼쪽 메뉴
   "API Keys" → "Create Key". `sk-ant-`로 시작하는 문자열을 복사해두세요.
   (참고: API 사용량은 Claude Code나 claude.ai 구독과는 별도로, 쓴 만큼
   과금돼요. 이 서버는 짧은 요청만 보내는 용도라 개인이 하루 몇 번 쓰는
   정도로는 한 달에 커피 한 잔 값도 안 나올 가능성이 높아요. console.anthropic.com
   의 "Billing"에서 사용량/한도를 확인·설정할 수 있어요.)
2. **GitHub 계정** — Render는 GitHub 저장소를 연결해서 배포해요.
3. 이 프로젝트 전체(godsaeng-app 폴더)를 본인 GitHub 저장소에 올려두세요.
   ```bash
   cd godsaeng-app
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<본인아이디>/godsaeng-app.git
   git push -u origin main
   ```

## 1. Render.com에서 새 Web Service 만들기

1. https://render.com 가입/로그인 (GitHub 계정으로 바로 가입 가능해요).
2. 대시보드에서 **New +** → **Web Service** 클릭.
3. 방금 올린 GitHub 저장소(godsaeng-app)를 선택하고 연결을 승인해요.
4. 아래 값들을 입력해요.
   - **Name**: `godsaeng-assistant` (원하는 이름 아무거나)
   - **Root Directory**: `server`  ← 반드시 `server` 폴더를 지정해야 해요.
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. **Environment Variables** 섹션에서 "Add Environment Variable"을 눌러
   아래 세 개를 추가해요.
   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | 아까 복사해 둔 `sk-ant-...` 키 |
   | `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` |
   | `APP_SHARED_SECRET` | 아무 긴 문자열(예: `godsaeng-2026-secret-xyz`) — 앱 설정 화면에도 나중에 똑같이 입력해요 |
6. **Create Web Service** 클릭. 2~3분 정도 빌드/배포가 진행돼요.
7. 배포가 끝나면 화면 위쪽에 `https://godsaeng-assistant.onrender.com` 같은
   주소가 보여요. 이 주소를 복사해두세요 — 앱 설정 화면의 "AI 서버 주소"에
   그대로 붙여넣을 거예요.

## 2. 서버가 잘 떴는지 확인하기

브라우저나 터미널에서:
```bash
curl https://<본인-서버-주소>.onrender.com/health
```
`{"ok":true,"model":"claude-haiku-4-5-20251001"}` 같은 응답이 오면 성공이에요.

## 3. 앱에 연결하기

1. 앱을 열고 **설정 → 비서에게 자연어로 말하기(실험적)** 로 들어가요.
2. "AI 서버 주소"에 위에서 확인한 `https://...onrender.com`을 입력해요.
3. "서버 비밀키"에 Render에 넣은 `APP_SHARED_SECRET`과 **똑같은 값**을 입력해요.
4. "연결 테스트"를 눌러 정상 응답이 오는지 확인해요.
5. 이제 채팅 화면에서 자유롭게 문장을 입력하면, 규칙 기반 해석 대신 이
   서버(Claude)가 이해해서 답해요. 서버 주소가 비어 있거나 연결에 실패하면
   앱은 자동으로 기존 규칙 기반 해석으로 되돌아가요(오프라인에서도 기본
   기능은 계속 동작해요).

## 4. (선택) 로컬 컴퓨터에서 직접 실행해보기

배포 전에 내 컴퓨터에서 먼저 테스트하고 싶다면:
```bash
cd server
cp .env.example .env   # .env 파일을 열어 실제 키 값으로 채워주세요
npm install
npm start
```
그 다음 휴대폰과 컴퓨터가 같은 Wi-Fi에 있다면, 앱 설정의 "AI 서버 주소"에
`http://<컴퓨터의-사설IP>:3000`을 넣어서 테스트할 수 있어요(예:
`http://192.168.0.12:3000`). 컴퓨터의 IP는 Windows는 `ipconfig`, Mac은
`ifconfig | grep inet`으로 확인해요.

## 5. 비용 관리 팁

- Render 무료 요금제는 매달 750시간(사실상 한 서비스를 24시간 켜둬도 충분)
  무료이고, 트래픽이 없으면 자동으로 잠들어서 리소스를 아껴요.
- Anthropic API 비용이 걱정되면 console.anthropic.com의 **Limits**에서
  월 사용 한도(예: $5)를 설정해두면, 그 이상은 자동으로 차단돼요.
- `ANTHROPIC_MODEL`을 더 저렴한 모델로 낮추거나(현재 기본값이 이미 가장
  저렴한 축인 Haiku예요), 서버 코드의 `rateBucket`(분당 요청 제한)으로
  실수로 반복 요청되는 것도 막아뒀어요.

## 6. 보안 참고

- `APP_SHARED_SECRET`은 "아무나 이 서버 주소를 알아도 함부로 못 쓰게" 막는
  최소한의 장치예요. 진짜 여러 사용자에게 서비스한다면 사용자별 로그인·키
  관리가 필요하지만, 지금은 태현님 한 분이 쓰는 개인 서버라 이 정도로
  충분해요.
- 이 서버는 사용자의 일정 데이터를 저장하지 않아요(요청마다 받은 내용을
  그 자리에서 Claude에 전달하고, 응답을 돌려준 뒤 버려요) — 그래서 별도의
  데이터베이스가 필요 없어요.
