// 갓생살자 — 자연어 명령 해석 서버
//
// 이 서버가 하는 일은 딱 하나예요: 앱이 보낸 "사용자가 채팅에 입력한 문장 +
// 오늘 일정 요약"을 받아서, Anthropic API(Claude)에게 "이건 무슨 명령이야?"를
// 구조화된 JSON으로 물어보고 그대로 돌려주는 것. 실제로 일정을 바꾸는 건
// 서버가 아니라 앱이에요 — 앱은 이 JSON을 사용자에게 "이렇게 할까요?"라고
// 확인받은 뒤에만 실제로 반영해요. 그래서 이 서버는 사용자의 일정 데이터를
// 저장하지 않고(무상태), 요청마다 받은 내용을 그 자리에서 처리하고 버려요.
//
// API 키를 클라이언트(휴대폰 앱)에 직접 넣지 않고 이 서버에만 두는 이유는,
// 앱 안에 키를 넣으면 누구나 앱을 뜯어서 그 키를 훔쳐 마음대로 쓸 수 있기
// 때문이에요. 서버에만 두면 서버 관리자(태현님)만 키를 볼 수 있어요.

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
// 앱 <-> 서버 사이의 아주 간단한 "같이 정한 비밀번호". 이 서버 URL을 아는
// 사람이면 누구나 요청을 보낼 수 있으니, 최소한의 보호로 헤더에 이 값을
// 넣지 않으면 요청을 거절해요. 앱 설정 화면과 이 서버 환경변수에 같은 값을
// 넣어주세요.
const SHARED_SECRET = process.env.APP_SHARED_SECRET || '';

if (!ANTHROPIC_API_KEY) {
  console.error('[fatal] ANTHROPIC_API_KEY 환경변수가 설정되지 않았어요. 서버를 시작할 수 없어요.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// 아주 단순한 메모리 rate limit — 같은 기기(IP)가 1분에 20번 넘게 요청하면
// 잠깐 막아요. 서버 재시작하면 초기화돼요. 사용자가 태현님 한 명뿐인
// 개인 프로젝트 규모에 맞춘 최소한의 안전장치예요.
const rateBucket = new Map();
function isRateLimited(key) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const entry = rateBucket.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateBucket.set(key, entry);
  return entry.count > max;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

const ACTION_TOOL = {
  name: 'respond_with_action',
  description:
    '사용자의 한국어 문장을 분석해서, 앱이 실행할 수 있는 구조화된 명령 하나로 바꿔서 돌려줘요.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: {
        type: 'string',
        enum: [
          'add_recurring_event',
          'add_adhoc_event',
          'delete_event',
          'reschedule_event',
          'change_duration',
          'mark_entry_status',
          'skip_next_week',
          'answer',
          'unknown',
        ],
        description: '실행할 동작의 종류. 순수 질문/정보 요청이면 answer, 뭘 원하는지 특정할 수 없으면 unknown.',
      },
      eventId: { type: 'string', description: '대상이 되는 기존 반복 일정의 id (context로 받은 목록 중 하나).' },
      entryId: { type: 'string', description: '대상이 되는 오늘 실행 항목의 id (context의 todayTimetable 중 하나).' },
      label: { type: 'string', description: '새로 만들 일정의 이름.' },
      time: { type: 'string', description: '"HH:MM" 24시간제.' },
      days: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
        description: '요일 배열 (0=일 ... 6=토). add_recurring_event에서 사용.',
      },
      dateKey: { type: 'string', description: '"YYYY-MM-DD". add_adhoc_event / mark_entry_status에서 사용.' },
      durationMinutes: { type: 'integer', description: '소요시간(분).' },
      newTime: { type: 'string', description: 'reschedule_event에서 새로 옮길 시각 "HH:MM".' },
      scope: {
        type: 'string',
        enum: ['today_only', 'from_now_on'],
        description: 'reschedule_event가 오늘 하루만 적용인지, 앞으로 계속인지.',
      },
      status: {
        type: 'string',
        enum: ['done_full', 'done_partial', 'done_none', 'skipped'],
        description: 'mark_entry_status에서 표시할 상태.',
      },
      requiresConfirmation: {
        type: 'boolean',
        description: '데이터를 실제로 바꾸는 동작이면 항상 true. answer/unknown이면 false.',
      },
      reply: {
        type: 'string',
        description: '사용자에게 채팅으로 보여줄 자연스러운 한국어 답변 한두 문장. 확인이 필요한 동작이면 "~할까요?" 형태로 물어보는 문장.',
      },
    },
    required: ['action', 'reply', 'requiresConfirmation'],
  },
};

const SYSTEM_PROMPT = `당신은 "갓생살자"라는 한국어 개인 일정 비서 앱의 자연어 해석기입니다.
사용자가 채팅으로 입력한 문장과 함께, 오늘 날짜/시각, 오늘의 시간표, 등록된
반복 일정 목록(id 포함)을 JSON context로 받습니다.

규칙:
1. 반드시 respond_with_action 도구를 한 번 호출해서만 답하세요. 다른 텍스트를 섞지 마세요.
2. 일정을 추가/삭제/시간변경/소요시간변경/완료체크 등 실제로 데이터를 바꾸는
   요청이면 requiresConfirmation을 true로 하고, reply는 "~할까요?"처럼 확인을
   구하는 자연스러운 문장으로 쓰세요. 앱이 이 reply를 보여주고 사용자가
   확정 버튼을 눌러야 실제로 반영됩니다 — 당신이 직접 반영하는 게 아닙니다.
3. 어떤 일정을 말하는지 context의 목록에서 이름이 비슷한 걸 찾아 eventId/entryId를
   채우세요. 못 찾겠으면 action을 unknown으로 하고 reply에 어떤 일정인지 되물으세요.
4. "오늘 남은 일정 알려줘", "이동 시간 고려하면 언제 출발해야 해?", "요즘 자주
   밀리는 일정이 뭐야?" 같은 순수 질문은 action=answer, requiresConfirmation=false로
   하고, context에 있는 정보만으로 정확하게 답하세요. 모르면 모른다고 하세요.
5. "급하지 않은 일정을 내일로 넘겨줘"처럼 여러 일정에 걸친 애매한 요청은,
   context의 오늘 일정 중 isFixed가 아닌 것들을 골라 reply에서 구체적으로
   "OO, XX를 내일로 옮길까요?"처럼 제안하고, action은 그 중 하나를 대표로
   골라 reschedule_event로 채우거나(하나뿐이면) 여러 개면 answer로 제안만 하세요.
6. 앱이 지원하지 않는 것(뉴스 요약, 날씨, 실제 통화 등)을 요청하면 unknown으로
   처리하고 reply에 아직 지원하지 않는다고 정중히 안내하세요.
7. 존댓말을 쓰고, 한두 문장으로 짧게 답하세요.`;

app.post('/api/parse', async (req, res) => {
  try {
    if (SHARED_SECRET) {
      const provided = req.header('x-app-secret');
      if (provided !== SHARED_SECRET) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    const { message, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message(string)가 필요해요.' });
    }

    const userContent = JSON.stringify({
      message,
      context: context || {},
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [ACTION_TOOL],
      tool_choice: { type: 'tool', name: 'respond_with_action' },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse) {
      return res.json({
        action: 'unknown',
        reply: '죄송해요, 잘 이해하지 못했어요. 다시 말씀해주실래요?',
        requiresConfirmation: false,
      });
    }
    return res.json(toolUse.input);
  } catch (err) {
    console.error('[parse error]', err);
    return res.status(500).json({
      action: 'unknown',
      reply: '지금은 서버에 문제가 있어서 이해하지 못했어요. 잠시 후 다시 시도해주세요.',
      requiresConfirmation: false,
      error: String(err && err.message ? err.message : err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`갓생살자 assistant server listening on :${PORT} (model=${MODEL})`);
});
