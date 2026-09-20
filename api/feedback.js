// api/feedback.js

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash";


// ==================================================
// 문자열 정리
// ==================================================

function clean(value, maxLength = 3000) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


// ==================================================
// 실험 데이터 정리
// ==================================================

function normalizeExperiment(exp = {}) {

  return {

    hypothesis:
      clean(exp.hypothesis),

    independentVariable:
      clean(exp.independentVariable),

    independentValues:
      clean(exp.independentValues),

    dependentVariable:
      clean(exp.dependentVariable),

    controlVariables:
      clean(exp.controlVariables),

    measurementMethod:
      clean(exp.measurementMethod),

    steps:
      clean(exp.steps),

    xAxis:
      clean(exp.xAxis),

    yAxis:
      clean(exp.yAxis)
  };
}


// ==================================================
// 전체 제안서 정리
// ==================================================

function normalizeProposal(raw = {}) {

  return {

    topic:
      clean(raw.topic),

    experiment1:
      normalizeExperiment(
        raw.experiment1 || {}
      ),

    experiment2:
      normalizeExperiment(
        raw.experiment2 || {}
      )
  };
}


// ==================================================
// 기본 누락 검사
// ==================================================

function findBasicIssues(data) {

  const issues = [];


  if (!data.topic) {

    issues.push({
      area: "탐구 주제",
      problem:
        "탐구 주제가 작성되지 않았어."
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


  /*
    실험Ⅰ과 실험Ⅱ의 조작 변인이
    완전히 같은 문자열이면 기본 단계에서도 확인한다.
  */

  const iv1 =
    normalizeComparisonText(
      data.experiment1.independentVariable
    );

  const iv2 =
    normalizeComparisonText(
      data.experiment2.independentVariable
    );


  if (
    iv1 &&
    iv2 &&
    iv1 === iv2
  ) {

    issues.push({
      area: "실험Ⅰ·Ⅱ 조작 변인",
      problem:
        "실험Ⅰ과 실험Ⅱ의 조작 변인이 같아. 두 실험에서 서로 다른 반응 속도 요인을 변화시키는지 확인해봐."
    });
  }


  return issues;
}


// ==================================================
// 각 실험 기본 검사
// ==================================================

function checkExperimentBasic(
  exp,
  label,
  issues
) {

  /*
    값이 실제로 비어 있을 때만
    미작성이라고 판단한다.
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
      area: `${label} - 조작 변인의 조건`,
      problem:
        "조작 변인의 구체적인 3가지 조건이 작성되지 않았어."
    });
  }


  if (!exp.dependentVariable) {

    issues.push({
      area: `${label} - 종속 변인`,
      problem:
        "종속 변인이 작성되지 않았어."
    });
  }


  if (!exp.controlVariables) {

    issues.push({
      area: `${label} - 통제 변인`,
      problem:
        "통제 변인이 작성되지 않았어."
    });
  }


  if (!exp.measurementMethod) {

    issues.push({
      area: `${label} - 측정 방법`,
      problem:
        "반응 속도의 변화를 어떻게 측정할지 작성되지 않았어."
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


// ==================================================
// 비교용 문자열
// ==================================================

function normalizeComparisonText(value) {

  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,/()_-]/g, "");
}


// ==================================================
// Gemini 선생님 프롬프트
// ==================================================

function buildTeacherPrompt(data) {

  return `
너는 고등학교 화학 수행평가의
'반응 속도 탐구 제안서'를 점검하는 교사다.

목표는 학생의 답을 대신 작성하는 것이 아니라
학생이 작성한 제안서에서 실제로 수정이 필요한 부분만
찾아주는 것이다.


==================================================
점검하지 않는 항목
==================================================

탐구 동기와 탐구 목적은 점검하지 않는다.

별도의 '사용할 화학 반응' 항목도 요구하지 않는다.

학생에게 특정 화학 반응을 추가로 작성하라고
요구하지 않는다.


==================================================
점검할 항목
==================================================

다음만 점검한다.

1. 탐구 주제
2. 실험Ⅰ
3. 실험Ⅱ
4. 그래프 제작 가능성


==================================================
가장 중요한 판정 원칙
==================================================

학생이 실제로 입력한 내용을 정확하게 읽어라.

어떤 필드의 문자열이 비어 있지 않다면
그 항목을

- 미작성
- 작성되지 않음
- 없음

이라고 판단해서는 안 된다.


특히 hypothesis 값이 비어 있지 않다면

'가설을 작성하지 않았다'

라고 절대로 말하지 않는다.


작성되어 있지만 내용이 부족한 경우에는

'가설은 작성되어 있으나 조작 변인과 측정하려는 값의
관계가 명확하지 않다'

처럼 실제 문제를 설명한다.


근거 없이 문제를 만들어내지 않는다.


==================================================
1. 탐구 주제
==================================================

탐구 주제가 반응 속도 탐구와 관련되어 있는지 확인한다.

다음을 살펴본다.

- 무엇을 탐구하려는지 알 수 있는가?
- 변화시키려는 조건이 드러나는가?
- 반응 속도의 변화와 연결되는가?
- 실험Ⅰ과 실험Ⅱ의 설계와 전체적으로 연결되는가?


중요:

학생에게 새로운 탐구 주제를 만들어주지 않는다.

완성된 탐구 주제를 대신 작성하지 않는다.

구체적인 화학 반응 예시를 제시하지 않는다.

부족한 부분이 있다면
무엇을 확인해야 하는지만 알려준다.


==================================================
2. 실험Ⅰ·Ⅱ 설계
==================================================

두 실험을 각각 확인한다.


------------------------------
가설
------------------------------

다음을 확인한다.

- 가설이 실제로 작성되어 있는가?
- 조작 변인이 드러나는가?
- 관찰하거나 측정할 변화가 드러나는가?
- 두 요소 사이의 예상 관계가 드러나는가?
- 실험을 통해 확인할 수 있는 가설인가?


가설 문자열이 비어 있지 않다면
절대로 '가설 미작성'이라고 말하지 않는다.


------------------------------
조작 변인
------------------------------

조작 변인이 반응 속도에 영향을 주는 조건인지 확인한다.

대표적인 반응 속도 요인은

- 농도
- 표면적
- 온도
- 촉매

등이다.


실험Ⅰ과 실험Ⅱ에서는
서로 다른 조작 변인을 사용하는지 확인한다.


단순히 표현이 조금 다르다는 이유만으로
서로 다른 조작 변인이라고 판단하지 않는다.

반대로 같은 의미인데 표현만 다른 경우에는
중복 여부를 판단한다.


------------------------------
조작 변인의 3가지 조건
------------------------------

각 실험에서 조작 변인을 비교하기 위한
3가지 구체적인 조건이 있는지 확인한다.

실제로 서로 비교할 수 있는 조건인지 확인한다.

학생에게 새로운 조건값을 대신 만들어주지는 않는다.


------------------------------
종속 변인
------------------------------

학생이 관찰하거나 측정하려는 결과가
무엇인지 확인한다.

실제 실험에서 확인할 수 있는 값인지 살펴본다.

다만 그래프의 Y축이 반드시 이 종속 변인과
완전히 동일해야 한다고 판단해서는 안 된다.


------------------------------
통제 변인
------------------------------

조작 변인 이외에
반응 속도에 영향을 줄 수 있는 조건이
적절하게 통제되는지 확인한다.


------------------------------
측정 방법
------------------------------

학생이 반응 속도의 변화 또는 차이를
판단할 수 있는 데이터를 얻을 수 있는 방법인지 확인한다.

실험에서 무엇을 관찰하거나 측정하는지
판단할 수 있어야 한다.


------------------------------
실험 과정
------------------------------

실험 과정은 3~5단계를 기준으로 확인한다.

다른 사람이 같은 실험을 다시 수행할 수 있을 정도로
구체적인지도 확인한다.

필요한 경우 다음을 살펴본다.

- 필요한 물질
- 물질의 양
- 부피
- 농도
- 온도
- 실험 기구
- 측정 방법
- 측정 시점
- 시간 간격
- 조작 변인의 조건
- 통제해야 하는 조건


모든 실험에 위 요소가 전부 들어가야 한다고
기계적으로 판단하지 않는다.

해당 실험을 재현하는 데 필요한 정보가
충분한지를 판단한다.


==================================================
3. 그래프 제작 가능성
==================================================

이 부분은 중요하게 점검한다.

학생은 나중에 AI를 이용하여
가상 실험 결과를 바탕으로 그래프를 제작할 예정이다.


그래프의 목적은 실험 결과를 이용하여

- 반응 속도의 변화
- 반응 속도의 추세
- 조건에 따른 반응 속도의 차이

중 하나 이상을 확인할 수 있도록 하는 것이다.


==================================================
그래프에 대한 중요한 원칙
==================================================

Y축이 반드시 학생이 작성한
'종속 변인'과 동일할 필요는 없다.

특정 그래프 형태만 정답으로 판단하지 않는다.

직선 그래프일 필요도 없다.

곡선 형태의 그래프도 가능하다.

조건별 결과를 비교하는 그래프도 가능하다.

시간에 따른 변화를 보여주는 그래프도 가능하다.

측정값을 이용하여 계산한 반응 속도를
비교하는 그래프도 가능하다.


따라서

'X축은 무조건 조작 변인'
또는
'Y축은 무조건 종속 변인'

같은 규칙을 적용하지 않는다.


==================================================
그래프에서 실제로 확인할 것
==================================================

학생이 작성한

- 조작 변인
- 조작 변인의 3가지 조건
- 측정 방법
- 실험 과정
- X축
- Y축

을 함께 살펴본다.


그리고 다음 질문을 중심으로 판단한다.


"이 실험 방법으로 가상 실험 결과를 만들었을 때,
학생이 작성한 X축과 Y축을 이용하여
실제로 그래프를 그릴 수 있는가?"


그리고


"그 그래프를 보면 반응 속도의 변화,
추세 또는 조건에 따른 차이를
확인하거나 비교할 수 있는가?"


두 질문에 모두 문제가 없다면
그래프 설계를 불필요하게 지적하지 않는다.


==================================================
그래프 값
==================================================

X축과 Y축에 들어갈 데이터가
학생이 작성한 실험에서 얻을 수 있거나
측정 결과를 이용하여 계산할 수 있는 값인지 확인한다.


그래프의 Y축이 종속 변인과
표현이 다르다는 이유만으로 문제라고 판단하지 않는다.


측정값에서 합리적으로 계산할 수 있는 값이라면
그래프에 사용할 수 있다.


==================================================
그래프 형태
==================================================

다음과 같은 그래프가 모두 가능할 수 있다.

- 시간에 따른 변화 그래프
- 곡선 형태의 그래프
- 조건별 비교 그래프
- 조작 변인에 따른 결과 비교 그래프
- 측정값으로 계산한 반응 속도 비교 그래프


특정 형태만 허용하지 않는다.


그래프가 직선이 아니라는 이유로
문제라고 판단하지 않는다.


==================================================
그래프 축
==================================================

X축과 Y축이 무엇을 의미하는지
알 수 있을 정도로 구체적인지 확인한다.

필요한 경우 단위가 판단 가능한지도 살펴본다.


그러나 사소한 표현 차이나
표현 방식의 차이만으로 문제를 만들지 않는다.


==================================================
그래프 문제를 지적해야 하는 경우
==================================================

예를 들어 다음과 같은 경우에는
그래프 설계 문제를 지적할 수 있다.

- 실험에서 얻을 수 없는 값을 축으로 사용한 경우
- X축 또는 Y축이 무엇을 의미하는지 알 수 없는 경우
- 측정 방법과 그래프에 사용할 값이 연결되지 않는 경우
- 작성된 실험으로는 그래프용 데이터를 만들 수 없는 경우
- 그래프를 그려도 반응 속도의 변화나 차이를 판단할 수 없는 경우


이 경우에도 완성된 X축이나 Y축을
대신 작성해주지 않는다.

무엇이 연결되지 않는지만 알려준다.


==================================================
4. 피드백 작성 규칙
==================================================

실제로 수정해야 하는 문제만 출력한다.

최대 5개만 출력한다.

문제가 2개라면 2개만 출력한다.

억지로 5개를 채우지 않는다.


칭찬은 출력하지 않는다.

학생의 내용을 요약하지 않는다.

점수나 등급을 매기지 않는다.

완성된 답안을 대신 작성하지 않는다.

완성된 탐구 주제를 만들어주지 않는다.

완성된 가설을 만들어주지 않는다.

완성된 실험 과정을 만들어주지 않는다.

완성된 X축과 Y축을 대신 제시하지 않는다.

구체적인 화학 반응을 예시로 제시하지 않는다.


각 문제는

1. 어느 부분인지
2. 무엇이 문제인지

짧고 구체적으로 알려준다.


그래프를 실제로 그리기 어려운 중요한 문제가 있다면
가능하면 최대 5개의 피드백 안에 포함한다.


==================================================
학생이 작성한 제안서
==================================================

${JSON.stringify(data, null, 2)}


==================================================
출력 형식
==================================================

반드시 JSON만 출력한다.

다른 문장을 JSON 앞이나 뒤에 붙이지 않는다.


형식:

{
  "issues": [
    {
      "area": "문제가 있는 영역",
      "problem": "수정이 필요한 이유"
    }
  ]
}


실제로 수정할 문제가 없다면:

{
  "issues": []
}
`;
}


// ==================================================
// Gemini 호출
// ==================================================

async function callGemini(data) {

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;


  const controller =
    new AbortController();


  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 18000);


  try {

    const response =
      await fetch(url, {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          contents: [
            {
              role: "user",

              parts: [
                {
                  text:
                    buildTeacherPrompt(data)
                }
              ]
            }
          ],

          generationConfig: {

            temperature: 0.1,

            maxOutputTokens: 900,

            responseMimeType:
              "application/json"
          }
        }),

        signal:
          controller.signal
      });


    let payload = {};


    try {

      payload =
        await response.json();

    } catch {

      payload = {};
    }


    return {

      ok:
        response.ok,

      status:
        response.status,

      payload
    };


  } catch (error) {


    if (
      error.name === "AbortError"
    ) {

      return {

        ok: false,

        status: 504,

        payload: {
          error: {
            message:
              "Gemini request timed out."
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


// ==================================================
// Gemini 응답 텍스트 추출
// ==================================================

function extractGeminiText(payload) {

  const candidates =
    Array.isArray(payload?.candidates)
      ? payload.candidates
      : [];


  for (
    const candidate of candidates
  ) {

    const parts =
      Array.isArray(
        candidate?.content?.parts
      )
        ? candidate.content.parts
        : [];


    for (
      const part of parts
    ) {

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


// ==================================================
// JSON 파싱
// ==================================================

function parseGeminiJson(text) {

  if (!text) {
    return null;
  }


  try {

    return JSON.parse(text);

  } catch {
    // 아래에서 한 번 더 처리
  }


  const cleaned =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();


  try {

    return JSON.parse(cleaned);

  } catch {

    return null;
  }
}


// ==================================================
// Gemini 혼잡 여부
// ==================================================

function isBusyError(result) {

  const message =
    String(
      result?.payload?.error?.message ||
      ""
    ).toLowerCase();


  return (

    [
      429,
      500,
      502,
      503,
      504
    ].includes(result?.status)

    ||

    message.includes(
      "high demand"
    )

    ||

    message.includes(
      "overloaded"
    )

    ||

    message.includes(
      "resource exhausted"
    )

    ||

    message.includes(
      "temporarily unavailable"
    )
  );
}


// ==================================================
// 중복 피드백 제거
// ==================================================

function mergeIssues(
  basicIssues,
  aiIssues
) {

  const result = [];

  const seen = new Set();


  const all = [
    ...(basicIssues || []),
    ...(aiIssues || [])
  ];


  for (
    const item of all
  ) {

    if (!item) continue;


    const area =
      clean(
        item.area,
        120
      );


    const problem =
      clean(
        item.problem,
        500
      );


    if (
      !area ||
      !problem
    ) {
      continue;
    }


    const key =
      `${area}|${problem}`
        .toLowerCase();


    if (
      seen.has(key)
    ) {
      continue;
    }


    seen.add(key);


    result.push({
      area,
      problem
    });


    if (
      result.length >= 5
    ) {
      break;
    }
  }


  return result;
}


// ==================================================
// API
// ==================================================

export default async function handler(
  req,
  res
) {

  // POST만 허용
  if (
    req.method !== "POST"
  ) {

    res.setHeader(
      "Allow",
      "POST"
    );


    return res
      .status(405)
      .json({
        message:
          "POST 요청만 사용할 수 있어."
      });
  }


  // Gemini API 키 확인
  if (
    !GEMINI_API_KEY
  ) {

    return res
      .status(500)
      .json({
        message:
          "서버에 GEMINI_API_KEY가 설정되지 않았어."
      });
  }


  try {

    const rawProposal =
      req.body?.proposal || {};


    const data =
      normalizeProposal(
        rawProposal
      );


    // -----------------------------------------
    // 기본 점검
    // -----------------------------------------

    const basicIssues =
      findBasicIssues(data);


    /*
      누락이 너무 많으면
      AI 호출을 아껴서 기본 결과만 표시
    */

    if (
      basicIssues.length >= 5
    ) {

      return res
        .status(200)
        .json({

          report: {

            issues:
              basicIssues.slice(
                0,
                5
              ),

            aiChecked:
              false,

            notice:
              "먼저 비어 있는 항목을 작성한 뒤 다시 점검해봐."
          }
        });
    }


    // -----------------------------------------
    // Gemini 점검
    // -----------------------------------------

    let geminiResult =
      await callGemini(data);


    /*
      서버 혼잡이면 딱 한 번만 재시도
    */

    if (
      !geminiResult.ok &&
      isBusyError(
        geminiResult
      )
    ) {

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            800
          )
      );


      geminiResult =
        await callGemini(data);
    }


    // -----------------------------------------
    // Gemini 실패
    // -----------------------------------------

    if (
      !geminiResult.ok
    ) {

      /*
        기본 검사에서 문제가 있었다면
        그것만이라도 보여줌
      */

      if (
        basicIssues.length > 0
      ) {

        return res
          .status(200)
          .json({

            report: {

              issues:
                basicIssues.slice(
                  0,
                  5
                ),

              aiChecked:
                false,

              notice:
                "AI 내용 점검은 현재 사용할 수 없어 기본 항목 점검 결과만 표시했어."
            }
          });
      }


      /*
        기본 항목은 채워져 있지만
        AI가 혼잡한 경우
        '문제없음'이라고 잘못 표시하지 않음
      */

      if (
        isBusyError(
          geminiResult
        )
      ) {

        return res
          .status(200)
          .json({

            report: {

              issues: [],

              aiChecked:
                false,

              notice:
                "기본 항목은 작성되어 있어. 현재 AI 내용 점검이 혼잡해서 실험 설계와 그래프 제작 가능성 점검은 완료하지 못했어."
            }
          });
      }


      return res
        .status(502)
        .json({

          message:
            "AI 내용 점검을 완료하지 못했어. 잠시 후 다시 시도해줘."
        });
    }


    // -----------------------------------------
    // Gemini 응답 읽기
    // -----------------------------------------

    const text =
      extractGeminiText(
        geminiResult.payload
      );


    const parsed =
      parseGeminiJson(text);


    if (!parsed) {

      if (
        basicIssues.length > 0
      ) {

        return res
          .status(200)
          .json({

            report: {

              issues:
                basicIssues.slice(
                  0,
                  5
                ),

              aiChecked:
                false,

              notice:
                "AI 응답을 정확하게 읽지 못해 기본 점검 결과만 표시했어."
            }
          });
      }


      return res
        .status(502)
        .json({

          message:
            "AI 점검 결과의 형식을 읽지 못했어. 다시 시도해줘."
        });
    }


    // -----------------------------------------
    // AI 피드백
    // -----------------------------------------

    const aiIssues =
      Array.isArray(
        parsed.issues
      )
        ? parsed.issues
        : [];


    // 기본 점검 + AI 점검 합치기
    const issues =
      mergeIssues(
        basicIssues,
        aiIssues
      );


    // -----------------------------------------
    // 최종 응답
    // -----------------------------------------

    return res
      .status(200)
      .json({

        report: {

          issues,

          aiChecked:
            true
        }
      });


  } catch (error) {

    console.error(
      "feedback API error:",
      error
    );


    return res
      .status(500)
      .json({

        message:
          "중간점검 처리 중 서버 오류가 발생했어."
      });
  }
}
