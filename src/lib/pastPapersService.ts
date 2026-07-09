// Stubs prepped for Supabase / Gemini wiring. Return mocked local data for now.

export type SmartExtractItem = {
  originalQuestion: string;
  rephrasedQuestion: string;
  marks: number;
  officialAnswerBullets: string[];
};

export type ExamSession = {
  sessionId: string;
  paper: string;
  subject: string;
  durationSeconds: number;
  startedAt: number;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchPaperPdf(paper: string, subject: string): Promise<{ url: string | null; paper: string; subject: string }> {
  await delay(200);
  // TODO(supabase): fetch signed URL from storage bucket "past-papers"
  return { url: null, paper, subject };
}

export async function startExamSession(paper: string, subject: string, durationSeconds = 2 * 60 * 60): Promise<ExamSession> {
  await delay(150);
  // TODO(supabase): insert row into exam_sessions and return id
  return {
    sessionId: `local-${Date.now()}`,
    paper,
    subject,
    durationSeconds,
    startedAt: Date.now(),
  };
}

export async function generateSmartExtract(paper: string, subject: string): Promise<SmartExtractItem[]> {
  // Simulate AI scan latency
  await delay(2200);
  // TODO(gemini): call model with paper + memo, parse JSON response
  return [
    {
      originalQuestion:
        "Explain, with reference to Newton's Second Law of Motion, why the acceleration of a system on a frictionless incline depends on the angle of the incline.",
      rephrasedQuestion: "Why does the incline angle change the acceleration of an object on a frictionless slope?",
      marks: 5,
      officialAnswerBullets: [
        "Net force along the incline is F_net = mg·sin(θ).",
        "By Newton's Second Law, F_net = ma, so a = g·sin(θ).",
        "As θ increases, sin(θ) increases, so acceleration increases.",
        "Mass cancels — acceleration is independent of mass on a frictionless incline.",
      ],
    },
    {
      originalQuestion:
        "Discuss the socio-economic impact of the discovery of gold on the Witwatersrand in the late 19th century.",
      rephrasedQuestion: "How did the Witwatersrand gold discovery reshape South Africa socially and economically?",
      marks: 8,
      officialAnswerBullets: [
        "Rapid urbanisation around Johannesburg.",
        "Influx of migrant labour and the emergence of the compound system.",
        "Shift from agrarian to industrial economy.",
        "Heightened tensions between Boer republics and British interests, contributing to the South African War.",
      ],
    },
    {
      originalQuestion:
        "Derive an expression for the equilibrium constant Kc of the reaction N2(g) + 3H2(g) ⇌ 2NH3(g) and explain the effect of increased pressure on the yield of ammonia.",
      rephrasedQuestion: "Write Kc for the ammonia synthesis and explain how higher pressure affects the yield.",
      marks: 6,
      officialAnswerBullets: [
        "Kc = [NH3]² / ([N2][H2]³).",
        "Le Chatelier: increased pressure favours the side with fewer moles of gas.",
        "Reactants have 4 mol gas, products have 2 mol gas.",
        "Equilibrium shifts to products — yield of NH3 increases.",
      ],
    },
    {
      originalQuestion:
        "Critically evaluate the use of fiscal policy versus monetary policy in addressing inflation in a developing economy.",
      rephrasedQuestion: "Compare fiscal and monetary policy as tools to fight inflation in a developing economy.",
      marks: 10,
      officialAnswerBullets: [
        "Monetary policy: interest rate adjustments by the central bank; fast to implement.",
        "Fiscal policy: government spending and taxation; slower, politically constrained.",
        "In developing economies, weak transmission channels limit monetary effectiveness.",
        "Balanced approach usually preferred — cite SARB inflation targeting as example.",
      ],
    },
    {
      originalQuestion:
        "Using a labelled free-body diagram, calculate the tension in a rope pulling a 20 kg crate up a 30° incline with a coefficient of kinetic friction of 0.15.",
      rephrasedQuestion: "Find the rope tension pulling a 20 kg crate up a 30° slope with μk = 0.15.",
      marks: 7,
      officialAnswerBullets: [
        "Weight component along slope: mg·sin(30°) = 20·9.8·0.5 = 98 N.",
        "Normal force: N = mg·cos(30°) ≈ 169.7 N.",
        "Friction: f = μk·N ≈ 25.5 N.",
        "Tension (constant velocity): T = 98 + 25.5 ≈ 123.5 N.",
      ],
    },
  ];
}
