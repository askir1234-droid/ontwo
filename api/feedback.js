function clean(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeProposal(raw = {}) {
  const p = raw || {};
  const arr = (v) => Array.isArray(v) ? v.map(x => clean(x, 1000)).filter(Boolean).slice(0, 20) : [];
  return {
    topic: clean(p.topic), motive: clean(p.motive), purpose: clean(p.purpose),
    reaction1: clean(p.reaction1), measureMethod1: clean(p.measureMethod1), hypothesis1: clean(p.hypothesis1), factor1: clean(p.factor1, 200), indep1: clean(p.indep1), control1: clean(p.control1), graphType1: clean(p.graphType1, 100), xAxis1: clean(p.xAxis1, 300), yAxis1: clean(p.yAxis1, 300), graphInterp1: clean(p.graphInterp1), steps1: arr(p.steps1),
    reaction2: clean(p.reaction2), measureMethod2: clean(p.measureMethod2), hypothesis2: clean(p.hypothesis2), factor2: clean(p.factor2, 200), indep2: clean(p.indep2), control2: clean(p.control2), graphType2: clean(p.graphType2, 100), xAxis2: clean(p.xAxis2, 300), yAxis2: clean(p.yAxis2, 300), graphInterp2: clean(p.graphInterp2), steps2: arr(p.steps2)
  };
}

function buildTeacherPrompt(data) {
  return `당신은 고등학교 화학 교사이자 탐구보고서 지도교사입니다. 학생의 탐구제안서를 실제 중간점검을 하는 교사처럼 엄격하지만 학생이 수정할 수 있도록 구체적으로 피드백하세요.

[점검 원칙]
- 학생이 실제로 작성한 내용만 근거로 판단하세요. 없는 내용을 추측해서 채우지 마세요.
- 과학적으로 틀렸거나 근거가 부족한 부분은 명확하게 지적하세요.
- '좋다/나쁘다'만 말하지 말고 왜 그런지 설명하세요.
- 실험에서 조작변인, 종속변인, 통제변인의 관계가 맞는지 확인하세요.
- '3수치'가 실제로 서로 다른 3개의 수준을 의미하는지 확인하세요.
- 측정방법이 종속변인을 실제로 측정할 수 있는지 확인하세요.
- 실험 과정에 필요한 기구와 측정 절차가 빠져 있지 않은지 확인하세요.
- 그래프의 X축은 무엇을 변화시키는지, Y축은 무엇을 측정하는지 일관성이 있는지 확인하세요.
- 실험 I과 II가 서로 다른 조작요인을 비교한다는 구조가 유지되는지 확인하세요.
- 학생 수준에서 수정할 수 있는 구체적인 문장 예시를 일부 제시하되, 학생의 탐구를 통째로 대신 작성하지 마세요.
- 평가 점수, 등급, 합격/불합격을 임의로 만들지 마세요.

반드시 아래 JSON 구조로만 답하세요.
{
  "overall": {"summary":"", "strengths":[""], "urgentFixes":[""]},
  "topic": {"status":"충분|보완필요|미작성", "feedback":"", "suggestion":""},
  "motive": {"status":"충분|보완필요|미작성", "feedback":"", "suggestion":""},
  "purpose": {"status":"충분|보완필요|미작성", "feedback":"", "suggestion":""},
  "experiment1": {"status":"충분|보완필요|미작성", "reaction":"", "measurement":"", "hypothesis":"", "variables":"", "threeLevels":"", "controls":"", "equipmentProcess":"", "graph":"", "suggestion":""},
  "experiment2": {"status":"충분|보완필요|미작성", "reaction":"", "measurement":"", "hypothesis":"", "variables":"", "threeLevels":"", "controls":"", "equipmentProcess":"", "graph":"", "suggestion":""},
  "finalChecklist":[{"item":"", "status":"완료|보완필요|미작성", "why":""}],
  "nextSteps":["", "", ""]
}

[학생 탐구제안서]
주제: ${data.topic || '미작성'}
동기: ${data.motive || '미작성'}
목적: ${data.purpose || '미작성'}

실험 I
조작요인: ${data.factor1 || '미선택'}
화학반응: ${data.reaction1 || '미작성'}
측정방법: ${data.measureMethod1 || '미작성'}
가설: ${data.hypothesis1 || '미작성'}
조작변인/3수치: ${data.indep1 || '미작성'}
통제변인: ${data.control1 || '미작성'}
과정: ${data.steps1.length ? data.steps1.join(' → ') : '미작성'}
그래프 유형: ${data.graphType1 || '미선택'}
X축: ${data.xAxis1 || '미작성'}
Y축: ${data.yAxis1 || '미작성'}
그래프 해석 계획: ${data.graphInterp1 || '미작성'}

실험 II
조작요인: ${data.factor2 || '미선택'}
화학반응: ${data.reaction2 || '미작성'}
측정방법: ${data.measureMethod2 || '미작성'}
가설: ${data.hypothesis2 || '미작성'}
조작변인/3수치: ${data.indep2 || '미작성'}
통제변인: ${data.control2 || '미작성'}
과정: ${data.steps2.length ? data.steps2.join(' → ') : '미작성'}
그래프 유형: ${data.graphType2 || '미선택'}
X축: ${data.xAxis2 || '미작성'}
Y축: ${data.yAxis2 || '미작성'}
그래프 해석 계획: ${data.graphInterp2 || '미작성'}`;
}

function extractText(payload) {
  return payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

function parseReport(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'POST 요청만 사용할 수 있어.' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ message: '서버에 GEMINI_API_KEY가 설정되지 않았어.' });
  }

  try {
    const proposal = normalizeProposal(req.body?.proposal);
    if (!proposal.topic && !proposal.motive && !proposal.purpose) {
      return res.status(400).json({ message: '탐구제안서 내용이 비어 있어.' });
    }

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: '학생의 탐구제안서를 과학적으로 점검하는 고등학교 화학 교사 역할을 수행한다. 학생이 작성하지 않은 내용을 사실처럼 추가하지 않는다.' }] },
        contents: [{ role: 'user', parts: [{ text: buildTeacherPrompt(proposal) }] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });

    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const message = payload?.error?.message || `Gemini API 오류 (${apiResponse.status})`;
      return res.status(502).json({ message });
    }

    const text = extractText(payload);
    if (!text) return res.status(502).json({ message: 'Gemini가 분석 결과를 반환하지 않았어.' });

    let report;
    try { report = parseReport(text); }
    catch { return res.status(502).json({ message: 'Gemini 응답을 JSON으로 해석하지 못했어.' }); }

    return res.status(200).json({ report });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '서버에서 Gemini 점검을 처리하는 중 오류가 발생했어.' });
  }
};
