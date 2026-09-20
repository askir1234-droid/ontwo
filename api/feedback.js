// api/feedback.js

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";


// --------------------------------------------------
// 문자열 정리
// --------------------------------------------------

function clean(value, maxLength = 3000) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .slice(0, maxLength);
}


// --------------------------------------------------
// 학생 제안서 데이터 정리
// index.html과 필드명을 동일하게 유지
// --------------------------------------------------

function normalizeExperiment(exp = {}) {
  return {
    reaction: clean(exp.reaction),
    measurementMethod: clean(exp.measurementMethod),

    hypothesis: clean(exp.hypothesis),

    independentVariable: clean(exp.independentVariable),
    independentValues: clean(exp.independentValues),

    dependentVariable: clean(exp.dependentVariable),
    controlVariables: clean(exp.controlVariables),

    steps: clean(exp.steps),

    xAxis: clean(exp.xAxis),
    yAxis: clean(exp.yAxis),

    graphInterpretation: clean(exp.graphInterpretation)
  };
}


function normalizeProposal(raw = {}) {
  return {
    topic: clean(raw.topic),

    experiment1: normalizeExperiment(
      raw.experiment1 || {}
    ),

    experiment2: normalizeExperiment(
      raw.experiment2 || {}
    )
  };
}


// --------------------------------------------------
// 기본 누락 검사
// Gemini를 호출하기 전에 서버에서 직접 확인
// --------------------------------------------------

function findBasicIssues(data) {
  const issues = [];

  if (!data.topic) {
    issues.push({
      area: "탐구 주제",
      problem: "탐구 주제가 작성되지 않았어."
    });
  }

  checkExperimentBasic(
    data.experiment1,
    "실험Ⅰ",
    issues
  );

  checkExperimentBasic(
    data.experiment2,
    "실험Ⅱ",
    issues
  );

  return issues;
}


function checkExperimentBasic(exp, label, issues) {

  if (!exp.reaction) {
    issues.push({
      area: `${label} - 화학 반응`,
      problem:
        "탐구할 화학 반응이 작성되지 않았어."
    });
  }

  /*
    중요:
    hypothesis 값이 실제로 존재하면
    절대로 '가설 미작성'이라고 판단하지 않는다.
  */
  if (!exp.hypothesis) {
    issues.push({
      area: `${label} - 가설`,
      problem:
        "가설이 작성되지 않았어."
    });
  }

  if (!exp.independentVariable) {
    issues.push({
      area: `${label} - 조작 변인`,
      problem:
        "조작 변인이 작성되지 않았어."
    });
  }

  if (!exp.independentValues) {
    issues.push({
      area: `${label} - 조작 변인의 값`,
      problem:
        "조작 변인의 구체적인 3가지 조건이 작성되지 않았어."
    });
  }

  if (!exp.dependentVariable) {
    issues.push({
      area: `${label} - 종속 변인`,
      problem:
        "측정할 종속 변인이 작성되지 않았어."
    });
  }

  if (!exp.measurementMethod) {
    issues.push({
      area: `${label} - 측정 방법`,
      problem:
        "반응 속도를 어떻게 측정할지 작성되지 않았어."
    });
  }

  if (!exp.steps) {
    issues.push({
      area: `${label} - 실험 과정`,
      problem:
        "실험 과정이 작성되지 않았어."
    });
  }

  if (!exp.xAxis) {
    issues.push({
      area: `${label} - 그래프 X축`,
      problem:
        "그래프의 X축이 작성되지 않았어."
    });
  }

  if (!exp.yAxis) {
    issues.push({
      area: `${label} - 그래프 Y축`,
      problem:
        "그래프의 Y축이 작성되지 않았어."
    });
  }
}


// --------------------------------------------------
// Gemini 선생님 프롬프트
// --------------------------------------------------

function buildTeacherPrompt(data) {

  return `
너는 고등학교 화학 수행평가의
'반응 속도 탐구 제안서'를 점검하는 교사다.

학생에게 정답이나 완성된 제안서를 대신 작성해주는 것이 아니라,
학생이 작성한 내용 중 과학적으로 잘못되었거나,
서로 맞지 않거나,
수행평가 조건을 충족하지 못한 부분만 찾아야 한다.

중요:
탐구 동기와 탐구 목적은 점검하지 않는다.

다음 네 영역만 점검한다.

1. 탐구 주제
2. 실험Ⅰ 설계
3. 실험Ⅱ 설계
4. 그래프 설계


==============================
가장 중요한 판정 원칙
==============================

학생이 실제로 작성한 내용을 정확하게 읽어라.

특정 필드에 글자가 들어 있다면
그 항목을 '미작성', '작성되지 않음', '없음'이라고
판단해서는 안 된다.

특히 hypothesis 값이 비어 있지 않다면
절대로 '가설을 작성하지 않았다'고 말하지 않는다.

작성되어 있지만 내용이 부적절하다면

'가설 미작성'

이라고 하지 말고

'가설은 작성되어 있으나 조작 변인과 종속 변인의
관계가 명확하지 않다'

처럼 실제 문제를 설명한다.


==============================
1. 탐구 주제 점검
==============================

탐구 주제는 반응 속도와 관련되어야 한다.

다음을 확인한다.

- 탐구 대상이 드러나는가?
- 조작 변인이 드러나는가?
- 종속 변인 또는 반응 속도를 나타내는 측정값이 드러나는가?
- 실험Ⅰ과 실험Ⅱ의 내용과 주제가 서로 연결되는가?

중요:
학생에게 새로운 탐구 주제 예시를 만들어주지 않는다.

완성된 탐구 주제 문장을 대신 작성하지 않는다.

부족한 요소가 무엇인지만 알려준다.


==============================
2. 실험 설계 점검
==============================

실험Ⅰ과 실험Ⅱ를 각각 점검한다.

다음을 확인한다.

[화학 반응]

- 실제로 탐구할 화학 반응이 명확한가?
- 작성된 반응을 이용하여 반응 속도를 관찰할 수 있는가?


[가설]

- 가설이 실제로 작성되어 있는가?
- 조작 변인이 포함되어 있는가?
- 종속 변인이 포함되어 있는가?
- 두 변인의 인과관계가 드러나는가?
- 실제 실험에서 측정 가능한 형태인가?

가설이 작성되어 있다면
절대로 미작성이라고 판단하지 않는다.


[조작 변인]

조작 변인은 원칙적으로 다음 반응 속도 요인 중
하나와 연결되어야 한다.

- 농도
- 표면적
- 온도
- 촉매

실험Ⅰ과 실험Ⅱ의 조작 변인은
서로 중복되지 않는지 확인한다.


[조작 변인의 3가지 값]

각 실험에서 조작 변인을 비교할 수 있도록
3가지 구체적인 조건 또는 값이 제시되어 있는지 확인한다.

예시를 새로 만들어 학생에게 제공하지 않는다.

3가지 값이 부족하다면
'조작 변인의 구체적인 3가지 조건이 필요하다'
정도로 알려준다.


[종속 변인]

종속 변인은 실제로 측정 가능한 값이어야 한다.

단순히

- 반응 정도
- 변화
- 반응이 잘 일어나는 정도

같이 수치화 방법이 불명확한 표현이면
측정 방법을 구체화할 필요가 있다고 알려준다.


[통제 변인]

조작 변인을 제외한 조건 중
반응 속도에 영향을 줄 수 있는 조건들이
적절하게 통제되어 있는지 확인한다.


[실험 과정]

실험 과정이 최소 3단계에서 최대 5단계인지 확인한다.

또한 다른 사람이 같은 실험을 다시 할 수 있을 정도로
구체적인지 확인한다.

필요에 따라 다음 내용을 살펴본다.

- 시약 또는 물질의 종류
- 물질의 양
- 부피
- 농도
- 온도
- 실험 기구
- 측정 방법
- 측정 시점 또는 시간 간격
- 조작 변인의 조건
- 통제해야 할 조건

단순히 항목이 있다는 이유만으로 문제없다고 판단하지 말고,
실험을 재현할 수 있는 수준인지 확인한다.


==============================
3. 그래프 설계 - 매우 중요
==============================

학생은 나중에 AI를 이용하여
가상 실험 결과를 바탕으로 그래프를 제작할 예정이다.

따라서 그래프 설계는 중요하게 점검한다.

각 실험에 대해 다음을 확인한다.


[A. X축]

X축이 실험 방식에 적합한지 확인한다.

반응 시간에 따른 변화를 관찰하는 방식이라면
시간이 X축이 될 수 있다.

조작 변인과 반응 속도를 직접 비교하는 방식이라면
조작 변인이 X축이 될 수 있다.

학생이 선택한 X축이
실제 실험 과정과 맞는지 판단한다.


[B. Y축]

Y축은 실제 실험에서 얻을 수 있는
측정값 또는 계산 가능한 값이어야 한다.

예를 들어 학생이 어떤 변화가 나타날 때까지 걸린
시간을 측정한다고 작성했다면,

그 측정값과 Y축이 논리적으로 연결되어야 한다.

반응 속도를 Y축으로 사용한다면
실제 측정값으로부터 반응 속도를 어떻게 표현할 수 있는지
판단 가능한 설계인지 확인한다.

필요한 경우 상대적인 반응 속도와
1/t와 같은 관계를 고려할 수 있다.

그러나 학생에게 새로운 실험값을 만들어주지는 않는다.


[C. 실험과 그래프의 일치]

다음을 서로 비교한다.

가설
→ 조작 변인
→ 조작 변인의 3가지 값
→ 종속 변인
→ 측정 방법
→ 실험 과정
→ X축
→ Y축

이 항목들이 하나의 논리적인 실험으로
연결되어 있는지 확인한다.

예를 들어 실험 과정에서는 한 종류의 값을 측정한다고 했는데
Y축에는 전혀 다른 측정량을 적었다면
반드시 문제로 지적한다.


[D. 가상 실험 결과 제작 가능성]

작성된 설계만 보고도
나중에 가상 실험 결과를 수치 또는 명확한 범주로
정리할 수 있는지 확인한다.

즉,

X값과 Y값을 대응시킨 데이터로 정리하고
그래프로 표현할 수 있을 정도로
축과 측정 방법이 구체적인지 판단한다.

축 이름이 지나치게 추상적이거나
무엇을 측정하는지 알 수 없다면 지적한다.


[E. 단위]

필요한 경우 축에 사용할 단위가
판단 가능한지도 확인한다.

단위가 반드시 필요한 측정량인데
어떤 단위로 측정할지 전혀 알 수 없다면
문제로 지적할 수 있다.


==============================
4. 피드백 작성 규칙
==============================

문제가 있는 부분만 알려준다.

칭찬이나 장문의 총평은 하지 않는다.

학생의 답을 대신 작성하지 않는다.

완성된 가설,
완성된 탐구 주제,
완성된 실험 과정,
완성된 그래프 축을
모범답안처럼 제공하지 않는다.

학생이 스스로 수정할 수 있도록

1. 어느 부분인지
2. 무엇이 문제인지

두 가지를 짧고 구체적으로 알려준다.

최대 5개만 출력한다.

그래프 설계에 중요한 문제가 있다면
가능하면 5개 문제 안에 포함한다.

근거 없이 문제를 만들어내지 않는다.

작성된 내용을 미작성이라고 판단하지 않는다.


==============================
학생이 작성한 내용
==============================

${JSON.stringify(data, null, 2)}


==============================
출력 형식
==============================

반드시 아래 JSON 형식으로만 응답한다.

{
  "issues": [
    {
      "area": "문제가 있는 영역",
      "problem": "구체적인 문제"
    }
  ]
}

문제가 없다면 다음과 같이 응답한다.

{
  "issues": []
}
`;
}


// --------------------------------------------------
// Gemini 호출
// --------------------------------------------------

async function callGemini(data) {

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;


  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 18000);


  try {

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildTeacherPrompt(data)
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 900,
          responseMimeType: "application/json"
        }
      }),

      signal: controller.signal
    });


    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }


    return {
      ok: response.ok,
      status: response.status,
      payload
    };

  } catch (error) {

    if (error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        payload: {
          error: {
            message: "Gemini request timed out."
          }
        }
      };
    }

    return {
      ok: false,
      status: 500,
      payload: {
        error: {
          message:
            error?.message ||
            "Gemini request failed."
        }
      }
    };

  } finally {

    clearTimeout(timeout);
  }
}


// --------------------------------------------------
// Gemini 응답에서 텍스트 추출
// --------------------------------------------------

function extractGeminiText(payload) {

  const candidates =
    Array.isArray(payload?.candidates)
      ? payload.candidates
      : [];

  for (const candidate of candidates) {

    const parts =
      Array.isArray(candidate?.content?.parts)
        ? candidate.content.parts
        : [];

    for (const part of parts) {

      if (
        typeof part?.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
}


// --------------------------------------------------
// JSON 파싱
// --------------------------------------------------

function parseGeminiJson(text) {

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // 코드 블록이 붙은 경우 제거
  }


  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();


  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}


// --------------------------------------------------
// Gemini 혼잡 여부
// --------------------------------------------------

function isBusyError(result) {

  const message =
    String(
      result?.payload?.error?.message || ""
    ).toLowerCase();


  return (
    [429, 500, 502, 503, 504].includes(
      result?.status
    ) ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("resource exhausted") ||
    message.includes("temporarily unavailable")
  );
}


// --------------------------------------------------
// 중복 피드백 제거
// --------------------------------------------------

function mergeIssues(basicIssues, aiIssues) {

  const result = [];

  const seen = new Set();


  const all = [
    ...(basicIssues || []),
    ...(aiIssues || [])
  ];


  for (const item of all) {

    if (!item) continue;

    const area =
      clean(item.area, 120);

    const problem =
      clean(item.problem, 500);


    if (!area || !problem) continue;


    const key =
      `${area}|${problem}`.toLowerCase();


    if (seen.has(key)) continue;

    seen.add(key);


    result.push({
      area,
      problem
    });


    if (result.length >= 5) {
      break;
    }
  }


  return result;
}


// --------------------------------------------------
// API
// --------------------------------------------------

export default async function handler(req, res) {

  // POST 요청만 허용
  if (req.method !== "POST") {

    res.setHeader("Allow", "POST");

    return res.status(405).json({
      message:
        "POST 요청만 사용할 수 있어."
    });
  }


  // API 키 확인
  if (!GEMINI_API_KEY) {

    return res.status(500).json({
      message:
        "서버에 GEMINI_API_KEY가 설정되지 않았어."
    });
  }


  try {

    const rawProposal =
      req.body?.proposal || {};

    const data =
      normalizeProposal(rawProposal);


    // -----------------------------
    // 서버 기본 점검
    // -----------------------------

    const basicIssues =
      findBasicIssues(data);


    /*
      누락이 너무 많으면 Gemini를 호출할 필요가 없다.
      무료 API 호출량 절약.
    */

    if (basicIssues.length >= 5) {

      return res.status(200).json({
        report: {
          issues:
            basicIssues.slice(0, 5),

          aiChecked: false,

          notice:
            "먼저 비어 있는 항목을 작성한 뒤 다시 점검해봐."
        }
      });
    }


    // -----------------------------
    // Gemini 점검
    // -----------------------------

    let geminiResult =
      await callGemini(data);


    /*
      혼잡할 때 한 번만 재시도
    */

    if (
      !geminiResult.ok &&
      isBusyError(geminiResult)
    ) {

      await new Promise(resolve =>
        setTimeout(resolve, 800)
      );

      geminiResult =
        await callGemini(data);
    }


    // -----------------------------
    // Gemini 사용 불가
    // -----------------------------

    if (!geminiResult.ok) {

      /*
        기본 점검에서 이미 문제가 발견되었다면
        Gemini가 실패해도 학생에게 그 결과를 보여준다.
      */

      if (basicIssues.length > 0) {

        return res.status(200).json({
          report: {
            issues:
              basicIssues.slice(0, 5),

            aiChecked: false,

            notice:
              "AI 내용 점검은 현재 사용할 수 없어 기본 항목 점검 결과만 표시했어."
          }
        });
      }


      /*
        입력은 갖춰져 있지만 Gemini가 혼잡한 경우
        '문제가 없다'고 잘못 말하지 않는다.
      */

      if (isBusyError(geminiResult)) {

        return res.status(200).json({
          report: {
            issues: [],

            aiChecked: false,

            notice:
              "기본 항목은 작성되어 있어. 현재 AI 내용 점검이 혼잡해서 과학적 내용과 그래프 설계 점검은 완료하지 못했어."
          }
        });
      }


      return res.status(502).json({
        message:
          "AI 내용 점검을 완료하지 못했어. 잠시 후 다시 시도해줘."
      });
    }


    // -----------------------------
    // Gemini 결과 파싱
    // -----------------------------

    const text =
      extractGeminiText(
        geminiResult.payload
      );


    const parsed =
      parseGeminiJson(text);


    if (!parsed) {

      if (basicIssues.length > 0) {

        return res.status(200).json({
          report: {
            issues:
              basicIssues.slice(0, 5),

            aiChecked: false,

            notice:
              "AI 응답을 정확하게 읽지 못해 기본 점검 결과만 표시했어."
          }
        });
      }


      return res.status(502).json({
        message:
          "AI 점검 결과의 형식을 읽지 못했어. 다시 시도해줘."
      });
    }


    const aiIssues =
      Array.isArray(parsed.issues)
        ? parsed.issues
        : [];


    const issues =
      mergeIssues(
        basicIssues,
        aiIssues
      );


    return res.status(200).json({
      report: {
        issues,
        aiChecked: true
      }
    });


  } catch (error) {

    console.error(
      "feedback API error:",
      error
    );


    return res.status(500).json({
      message:
        "중간점검 처리 중 서버 오류가 발생했어."
    });
  }
}
