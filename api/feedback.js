function clean(value, max = 2500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeProposal(raw = {}) {
  const p = raw || {};

  const arr = (v) =>
    Array.isArray(v)
      ? v.map(x => clean(x, 600)).filter(Boolean).slice(0, 15)
      : [];

  return {
    topic: clean(p.topic),
    motive: clean(p.motive),
    purpose: clean(p.purpose),

    reaction1: clean(p.reaction1),
    measureMethod1: clean(p.measureMethod1),
    hypothesis1: clean(p.hypothesis1),
    factor1: clean(p.factor1, 200),
    indep1: clean(p.indep1),
    control1: clean(p.control1),
    graphType1: clean(p.graphType1, 100),
    xAxis1: clean(p.xAxis1, 300),
    yAxis1: clean(p.yAxis1, 300),
    graphInterp1: clean(p.graphInterp1),
    steps1: arr(p.steps1),

    reaction2: clean(p.reaction2),
    measureMethod2: clean(p.measureMethod2),
    hypothesis2: clean(p.hypothesis2),
    factor2: clean(p.factor2, 200),
    indep2: clean(p.indep2),
    control2: clean(p.control2),
    graphType2: clean(p.graphType2, 100),
    xAxis2: clean(p.xAxis2, 300),
    yAxis2: clean(p.yAxis2, 300),
    graphInterp2: clean(p.graphInterp2),
    steps2: arr(p.steps2)
  };
}


/* -------------------------------------------------------
   Gemini가 굳이 검사할 필요가 없는 단순 누락은
   서버에서 바로 찾아냄
------------------------------------------------------- */

function findMissingFields(data) {
  const issues = [];

  if (!data.topic) {
    issues.push({
      area: '탐구 주제',
      problem: '탐구 주제가 작성되지 않았어.'
    });
  }

  if (!data.purpose) {
    issues.push({
      area: '탐구 목적',
      problem: '탐구 목적이 작성되지 않았어.'
    });
  }

  if (!data.hypothesis1) {
    issues.push({
      area: '실험 I 가설',
      problem: '검증할 가설이 작성되지 않았어.'
    });
  }

  if (!data.indep1) {
    issues.push({
      area: '실험 I 조작변인',
      problem: '조작변인과 비교할 수치가 작성되지 않았어.'
    });
  }

  if (!data.measureMethod1) {
    issues.push({
      area: '실험 I 측정방법',
      problem: '종속변인을 어떻게 측정할지 작성되지 않았어.'
    });
  }

  if (!data.steps1.length) {
    issues.push({
      area: '실험 I 과정',
      problem: '실험 과정이 작성되지 않았어.'
    });
  }

  if (!data.xAxis1 || !data.yAxis1) {
    issues.push({
      area: '실험 I 그래프',
      problem: '그래프의 X축 또는 Y축이 작성되지 않았어.'
    });
  }

  if (!data.hypothesis2) {
    issues.push({
      area: '실험 II 가설',
      problem: '검증할 가설이 작성되지 않았어.'
    });
  }

  if (!data.indep2) {
    issues.push({
      area: '실험 II 조작변인',
      problem: '조작변인과 비교할 수치가 작성되지 않았어.'
    });
  }

  if (!data.measureMethod2) {
    issues.push({
      area: '실험 II 측정방법',
      problem: '종속변인을 어떻게 측정할지 작성되지 않았어.'
    });
  }

  if (!data.steps2.length) {
    issues.push({
      area: '실험 II 과정',
      problem: '실험 과정이 작성되지 않았어.'
    });
  }

  if (!data.xAxis2 || !data.yAxis2) {
    issues.push({
      area: '실험 II 그래프',
      problem: '그래프의 X축 또는 Y축이 작성되지 않았어.'
    });
  }

  return issues;
}


/* -------------------------------------------------------
   짧고 빠른 Gemini 점검 프롬프트
------------------------------------------------------- */

function buildTeacherPrompt(data) {
  return `
너는 고등학교 화학 탐구제안서의 중간점검을 담당하는 교사다.

목표는 학생의 제안서를 대신 작성하는 것이 아니라
학생이 다시 확인해야 할 잘못된 점, 모순, 불명확한 점을 찾는 것이다.

다음만 확인하라.

1. 탐구 목적과 실험 내용이 서로 연결되는가?
2. 가설이 실제 실험으로 검증 가능한가?
3. 조작변인과 종속변인의 관계가 올바른가?
4. 통제변인이 적절한가?
5. 조작변인의 3가지 수치가 실제 비교 가능한 값인가?
6. 측정방법으로 종속변인을 실제 측정할 수 있는가?
7. 실험 과정과 변인 설정 사이에 모순이 있는가?
8. 그래프 X축과 Y축이 변인과 일치하는가?
9. 실험 I과 실험 II가 서로 다른 조작요인을 비교하고 있는가?
10. 화학적으로 명백하게 잘못된 내용이 있는가?

중요한 규칙:

- 문제가 있는 부분만 알려라.
- 문제가 없는 부분은 설명하지 마라.
- 가장 중요한 문제를 최대 5개만 선택하라.
- 각 문제는 짧게 설명하라.
- 학생의 문장을 대신 작성하지 마라.
- 모범답안을 제공하지 마라.
- 과도한 칭찬이나 총평을 하지 마라.
- 점수나 등급을 매기지 마라.
- 학생이 작성하지 않은 내용을 추측하지 마라.

반드시 다음 JSON 형식으로만 답하라.

{
  "issues": [
    {
      "area": "문제가 있는 부분",
      "problem": "무엇을 다시 확인해야 하는지 짧게 설명"
    }
  ]
}

문제가 발견되지 않으면:

{
  "issues": []
}

[학생 탐구제안서]

탐구 주제:
${data.topic || '미작성'}

탐구 동기:
${data.motive || '미작성'}

탐구 목적:
${data.purpose || '미작성'}

[실험 I]

조작요인:
${data.factor1 || '미작성'}

화학반응:
${data.reaction1 || '미작성'}

측정방법:
${data.measureMethod1 || '미작성'}

가설:
${data.hypothesis1 || '미작성'}

조작변인과 3수치:
${data.indep1 || '미작성'}

통제변인:
${data.control1 || '미작성'}

실험 과정:
${data.steps1.length ? data.steps1.join(' → ') : '미작성'}

그래프:
X축=${data.xAxis1 || '미작성'}
Y축=${data.yAxis1 || '미작성'}

[실험 II]

조작요인:
${data.factor2 || '미작성'}

화학반응:
${data.reaction2 || '미작성'}

측정방법:
${data.measureMethod2 || '미작성'}

가설:
${data.hypothesis2 || '미작성'}

조작변인과 3수치:
${data.indep2 || '미작성'}

통제변인:
${data.control2 || '미작성'}

실험 과정:
${data.steps2.length ? data.steps2.join(' → ') : '미작성'}

그래프:
X축=${data.xAxis2 || '미작성'}
Y축=${data.yAxis2 || '미작성'}
`;
}


function extractText(payload) {
  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || '')
      .join('') || ''
  );
}


function parseReport(text) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}


/* 잠깐 기다리는 함수 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* -------------------------------------------------------
   Gemini 호출
------------------------------------------------------- */

async function callGemini(apiKey, model, prompt) {

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              '고등학교 화학 탐구제안서에서 오류, 누락, 모순을 짧게 찾아주는 교사 역할을 한다.'
          }]
        },

        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],

        generationConfig: {
          temperature: 0.1,

          /* 기존 4096 → 700 */
          maxOutputTokens: 700,

          responseMimeType: 'application/json'
        }
      })
    }
  );

  const payload = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}


/* -------------------------------------------------------
   Vercel API
------------------------------------------------------- */

module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {

    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      message: 'POST 요청만 사용할 수 있어.'
    });
  }


  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const GEMINI_MODEL =
    process.env.GEMINI_MODEL || 'gemini-3.8-flash';


  if (!GEMINI_API_KEY) {

    return res.status(503).json({
      message: '서버에 Gemini API가 설정되지 않았어.'
    });
  }


  try {

    const proposal =
      normalizeProposal(req.body?.proposal);


    if (
      !proposal.topic &&
      !proposal.motive &&
      !proposal.purpose
    ) {

      return res.status(400).json({
        message: '탐구제안서 내용이 비어 있어.'
      });
    }


    /* ------------------------------------
       1. 서버 자체 누락 검사
    ------------------------------------ */

    const localIssues =
      findMissingFields(proposal);


    /*
      이미 작성 누락이 5개 이상이면
      Gemini를 호출할 필요가 없음.

      → API 사용량 절약
      → 결과 즉시 표시
    */

    if (localIssues.length >= 5) {

      return res.status(200).json({
        report: {
          issues: localIssues.slice(0, 5),
          source: 'basic-check'
        }
      });
    }


    /* ------------------------------------
       2. Gemini 내용 검사
    ------------------------------------ */

    const prompt =
      buildTeacherPrompt(proposal);


    let result =
      await callGemini(
        GEMINI_API_KEY,
        GEMINI_MODEL,
        prompt
      );


    /*
      429 = 요청 제한
      503 = Gemini 일시적 혼잡

      오래 기다리지 않고
      딱 한 번만 짧게 재시도
    */

    if (
      result.status === 429 ||
      result.status === 503
    ) {

      await sleep(700);

      result =
        await callGemini(
          GEMINI_API_KEY,
          GEMINI_MODEL,
          prompt
        );
    }


    if (!result.ok) {

      /*
        Gemini가 혼잡해도
        로컬에서 발견한 문제가 있다면
        그것이라도 학생에게 보여줌
      */

      if (localIssues.length) {

        return res.status(200).json({
          report: {
            issues: localIssues.slice(0, 5),
            source: 'basic-check'
          }
        });
      }


      const message =
        result.payload?.error?.message ||
        `Gemini API 오류 (${result.status})`;


      return res.status(502).json({
        message:
          result.status === 429 ||
          result.status === 503
            ? '현재 AI 점검 요청이 많아. 잠시 후 다시 시도해줘.'
            : message
      });
    }


    const text =
      extractText(result.payload);


    if (!text) {

      return res.status(502).json({
        message:
          'Gemini가 점검 결과를 반환하지 않았어.'
      });
    }


    let aiReport;


    try {

      aiReport =
        parseReport(text);

    } catch {

      return res.status(502).json({
        message:
          'Gemini 점검 결과를 처리하지 못했어.'
      });
    }


    const aiIssues =
      Array.isArray(aiReport?.issues)
        ? aiReport.issues
        : [];


    /*
      로컬 검사 + AI 검사 합치기
    */

    const combined = [
      ...localIssues,
      ...aiIssues
    ];


    return res.status(200).json({

      report: {

        issues:
          combined.slice(0, 5),

        source: 'ai-check'
      }

    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      message:
        '점검을 처리하는 중 오류가 발생했어.'
    });
  }
};
