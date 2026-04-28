export const CODING_LESSON_IDS = ["reverse-string", "sum-array"] as const;

export type CodingLessonId = (typeof CODING_LESSON_IDS)[number];

export type CodingTestCase = {
  args: unknown[];
  expected: unknown;
  label: string;
};

export type CodingLesson = {
  concept: string;
  functionName: string;
  hints: string[];
  id: CodingLessonId;
  prompt: string;
  solution: string;
  starterCode: string;
  tests: CodingTestCase[];
  title: string;
};

export type CodingTestResult = {
  actual?: unknown;
  error?: string;
  expected: unknown;
  label: string;
  pass: boolean;
};

export type CodingRunResult = {
  error?: string;
  ok: boolean;
  passedCount: number;
  results: CodingTestResult[];
  totalCount: number;
};

export const CODING_LESSONS: CodingLesson[] = [
  {
    id: "reverse-string",
    title: "Reverse a string",
    concept: "strings, loops, and return values",
    functionName: "reverseString",
    prompt:
      "Write a function named reverseString that receives a string and returns the characters in reverse order.",
    starterCode: `function reverseString(text) {
  // Write your code here
  return text;
}`,
    solution: `function reverseString(text) {
  return text.split("").reverse().join("");
}`,
    hints: [
      "Start with an empty string that will hold the reversed answer.",
      "Walk through the input from the final character down to the first character.",
      "Add each character to your answer, then return that answer after the loop.",
    ],
    tests: [
      { label: "reverses a short word", args: ["code"], expected: "edoc" },
      { label: "keeps punctuation in reversed order", args: ["hello!"], expected: "!olleh" },
      { label: "handles an empty string", args: [""], expected: "" },
    ],
  },
  {
    id: "sum-array",
    title: "Sum an array",
    concept: "arrays, numbers, and accumulators",
    functionName: "sumArray",
    prompt: "Write a function named sumArray that receives an array of numbers and returns the total.",
    starterCode: `function sumArray(numbers) {
  // Write your code here
  return 0;
}`,
    solution: `function sumArray(numbers) {
  return numbers.reduce((total, number) => total + number, 0);
}`,
    hints: [
      "Create a total variable and start it at 0.",
      "Loop over every number in the array and add it to the total.",
      "Return the total after the loop has finished.",
    ],
    tests: [
      { label: "adds positive numbers", args: [[1, 2, 3, 4]], expected: 10 },
      { label: "handles an empty array", args: [[]], expected: 0 },
      { label: "includes negative numbers", args: [[10, -3, 5]], expected: 12 },
    ],
  },
];

export const DEFAULT_CODING_LESSON_ID = CODING_LESSONS[0]!.id;

const CODING_LESSON_BY_ID = new Map(CODING_LESSONS.map((lesson) => [lesson.id, lesson]));

export const CODING_DEMO_INSTRUCTIONS = [
  "You are a concise voice coding tutor controlling a beginner JavaScript lesson in a React app.",
  "You control the visible coding tutor UI with tools. This is not a general chat.",
  "The student is learning, so prefer hints, questions, and step-by-step guidance over dumping a final answer.",
  "You have exactly nine tools: get_lesson_state, set_code, run_tests, give_hint, reveal_solution, reset_code, change_lesson, set_tutor_note, and change_demo.",
  "If a tool can satisfy the request, call the tool instead of replying in text.",
  "Use get_lesson_state when you need the current code, selected lesson, hint level, or latest test result before deciding.",
  "Use run_tests when the user asks to test, run, check, submit, grade, or see whether the code works.",
  "Use give_hint when the user asks for help, a hint, or says they are stuck. Do not reveal the full solution unless they ask for the answer or solution.",
  "Use set_code only when the user asks you to replace the editor contents or gives explicit code to insert.",
  "Use set_tutor_note for short explanations, feedback, or Socratic questions that should appear in the tutor panel.",
  "Keep tutor notes under three short sentences and use beginner-friendly language.",
  "Use reveal_solution only when the user explicitly asks for the solution, the answer, or to show the completed code.",
  "Use reset_code when the user asks to start over or reset the code.",
  'Use change_lesson with { "lesson": "reverse-string" } for string reversal, reversing text, or string practice.',
  'Use change_lesson with { "lesson": "sum-array" } for arrays, totals, summing numbers, or accumulator practice.',
  'Use change_demo with { "demo": "theme" }, { "demo": "form" }, or { "demo": "chess" } only when the user asks to leave the coding tutor for another demo.',
  "Do not invent unsupported tools, hidden files, or background code execution outside the visible lesson.",
].join(" ");

export function getCodingLesson(id: CodingLessonId) {
  return CODING_LESSON_BY_ID.get(id) ?? CODING_LESSONS[0]!;
}

function formatValue(value: unknown) {
  return JSON.stringify(value);
}

function isDeepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function runCodingLessonTests(code: string, lesson: CodingLesson): CodingRunResult {
  let candidate: unknown;

  try {
    candidate = new Function(`${code}\nreturn ${lesson.functionName};`)();
  } catch (error) {
    return {
      ok: false,
      passedCount: 0,
      totalCount: lesson.tests.length,
      results: [],
      error: error instanceof Error ? error.message : "The code could not be parsed.",
    };
  }

  if (typeof candidate !== "function") {
    return {
      ok: false,
      passedCount: 0,
      totalCount: lesson.tests.length,
      results: [],
      error: `Expected to find a function named ${lesson.functionName}.`,
    };
  }

  const results = lesson.tests.map((test) => {
    try {
      const actual = candidate(...test.args);
      return {
        actual,
        expected: test.expected,
        label: test.label,
        pass: isDeepEqual(actual, test.expected),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "The test threw an unknown error.",
        expected: test.expected,
        label: test.label,
        pass: false,
      };
    }
  });
  const passedCount = results.filter((result) => result.pass).length;

  return {
    ok: passedCount === results.length,
    passedCount,
    results,
    totalCount: results.length,
  };
}

export function buildCodingStateMessage(options: {
  code: string;
  hintIndex: number;
  lesson: CodingLesson;
  testRun: CodingRunResult | null;
  tutorNote: string;
}) {
  const { code, hintIndex, lesson, testRun, tutorNote } = options;
  const testSummary = testRun
    ? `${testRun.passedCount}/${testRun.totalCount} tests passing${
        testRun.error ? ` with error: ${testRun.error}` : ""
      }`
    : "not run yet";

  return [
    "Coding tutor state update: the visible app is a beginner JavaScript lesson.",
    `Lesson=${lesson.id}.`,
    `Title=${lesson.title}.`,
    `Function name=${lesson.functionName}.`,
    `Hints used=${hintIndex}/${lesson.hints.length}.`,
    `Latest test result=${testSummary}.`,
    `Tutor note=${tutorNote || "<empty>"}.`,
    `Current code: ${code}`,
  ].join(" ");
}

export function buildRunResultMessage(result: CodingRunResult) {
  if (result.error) {
    return `Tests could not run: ${result.error}`;
  }

  if (result.ok) {
    return `All ${result.totalCount} tests passed. Nice work.`;
  }

  const firstFailure = result.results.find((test) => !test.pass);

  if (!firstFailure) {
    return `${result.passedCount}/${result.totalCount} tests passed.`;
  }

  const actual = firstFailure.error ? `error: ${firstFailure.error}` : formatValue(firstFailure.actual);

  return `${result.passedCount}/${result.totalCount} tests passed. First issue: ${firstFailure.label} expected ${formatValue(
    firstFailure.expected,
  )} but got ${actual}.`;
}
