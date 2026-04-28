import { defineVoiceTool, type UseGhostCursorReturn } from "realtime-voice-component";
import { z } from "zod";

import {
  CODING_LESSON_IDS,
  buildRunResultMessage,
  getCodingLesson,
  type CodingLesson,
  type CodingLessonId,
  type CodingRunResult,
} from "./config";

type CodingLessonState = {
  code: string;
  hintIndex: number;
  lesson: CodingLesson;
  testRun: CodingRunResult | null;
  tutorNote: string;
};

type CreateCodingToolOptions = {
  getEditorElement: () => HTMLElement | null;
  getLessonButton: (lesson: CodingLessonId) => HTMLElement | null;
  getResetButton: () => HTMLElement | null;
  getRunButton: () => HTMLButtonElement | null;
  getState: () => CodingLessonState;
  runCursor: UseGhostCursorReturn["run"];
  setCode: (code: string) => void;
  setLesson: (lesson: CodingLessonId) => void;
  setTutorNote: (message: string) => void;
  showNextHint: () => { hint: string; hintIndex: number; exhausted: boolean };
  revealSolution: () => void;
  resetCode: () => void;
  runTests: () => CodingRunResult;
};

type VisibleScreenItem = {
  id: string;
  role: string;
  text: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const SCREEN_LANDMARKS = {
  center: { x: 0.5, y: 0.5 },
  "top-left": { x: 0.15, y: 0.15 },
  "top-center": { x: 0.5, y: 0.15 },
  "top-right": { x: 0.85, y: 0.15 },
  "middle-left": { x: 0.15, y: 0.5 },
  "middle-right": { x: 0.85, y: 0.5 },
  "bottom-left": { x: 0.15, y: 0.85 },
  "bottom-center": { x: 0.5, y: 0.85 },
  "bottom-right": { x: 0.85, y: 0.85 },
} as const;

type ScreenLandmark = keyof typeof SCREEN_LANDMARKS;

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isVisibleInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) !== 0
  );
}

function getElementRole(element: HTMLElement) {
  const explicitRole = element.getAttribute("role");
  if (explicitRole) {
    return explicitRole;
  }

  if (element instanceof HTMLButtonElement) {
    return "button";
  }
  if (element instanceof HTMLAnchorElement) {
    return "link";
  }
  if (element instanceof HTMLTextAreaElement) {
    return "text editor";
  }
  if (element instanceof HTMLInputElement) {
    return "input";
  }
  if (/^H[1-6]$/.test(element.tagName)) {
    return "heading";
  }

  return element.tagName.toLowerCase();
}

function getElementLabel(element: HTMLElement) {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value || element.placeholder || element.name || element.id;
  }

  return element.innerText.trim();
}

function getVisibleScreenItems() {
  if (typeof document === "undefined") {
    return [];
  }

  const selector = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "[role]",
    "[aria-label]",
    "[data-ai-target]",
    "h1",
    "h2",
    "h3",
    "h4",
    "p",
    "label",
    "li",
    "code",
    "pre",
  ].join(",");

  const elements = Array.from(document.body.querySelectorAll<HTMLElement>(selector));
  const items: Array<VisibleScreenItem & { element: HTMLElement; normalizedText: string }> = [];

  for (const element of elements) {
    if (element.closest(".vc-ghost-cursor") || !isVisibleInViewport(element)) {
      continue;
    }

    const text = getElementLabel(element).replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    items.push({
      element,
      id: `item-${items.length + 1}`,
      normalizedText: normalizeSearchText(text),
      role: getElementRole(element),
      text: text.slice(0, 180),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  return items;
}

function findBestVisibleScreenItem(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);
  const items = getVisibleScreenItems();

  return items
    .map((item) => {
      let score = 0;
      if (item.normalizedText === normalizedQuery) {
        score += 100;
      }
      if (item.normalizedText.includes(normalizedQuery)) {
        score += 60;
      }
      if (item.normalizedText.startsWith(normalizedQuery)) {
        score += 20;
      }
      for (const term of queryTerms) {
        if (item.normalizedText.includes(term)) {
          score += 8;
        }
      }
      if (item.role === "button" || item.role === "link") {
        score += 4;
      }

      return { item, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)[0];
}

export function createGetLessonStateTool({ getState }: Pick<CreateCodingToolOptions, "getState">) {
  return defineVoiceTool({
    name: "get_lesson_state",
    description: "Inspect the current coding lesson, editor code, hint progress, and latest tests.",
    parameters: z.object({}),
    async execute() {
      const state = getState();

      return {
        ok: true,
        lesson: {
          id: state.lesson.id,
          title: state.lesson.title,
          concept: state.lesson.concept,
          prompt: state.lesson.prompt,
          functionName: state.lesson.functionName,
        },
        code: state.code,
        hintIndex: state.hintIndex,
        hintCount: state.lesson.hints.length,
        latestTestRun: state.testRun,
        tutorNote: state.tutorNote,
      };
    },
  });
}

export function createSetCodeTool({
  getEditorElement,
  runCursor,
  setCode,
}: Pick<CreateCodingToolOptions, "getEditorElement" | "runCursor" | "setCode">) {
  return defineVoiceTool({
    name: "set_code",
    description: "Replace the visible code editor contents with explicit code from the user.",
    parameters: z.object({
      code: z.string().min(1).max(2000),
    }),
    async execute({ code }) {
      const editor = getEditorElement();

      await runCursor(
        {
          element: editor,
          pulseElement: editor,
        },
        async () => {
          setCode(code);
        },
        {
          easing: "smooth",
          from: "previous",
        },
      );

      return { ok: true, code };
    },
  });
}

export function createRunTestsTool({
  getRunButton,
  runCursor,
  runTests,
}: Pick<CreateCodingToolOptions, "getRunButton" | "runCursor" | "runTests">) {
  return defineVoiceTool({
    name: "run_tests",
    description: "Run the visible lesson tests against the current code.",
    parameters: z.object({}),
    async execute() {
      const button = getRunButton();

      const result = await runCursor(
        {
          element: button,
          pulseElement: button,
        },
        async () => runTests(),
        {
          easing: "smooth",
          from: "previous",
        },
      );

      const message = buildRunResultMessage(result);

      return {
        message,
        ...result,
      };
    },
  });
}

export function createGiveHintTool({
  showNextHint,
  setTutorNote,
}: Pick<CreateCodingToolOptions, "showNextHint" | "setTutorNote">) {
  return defineVoiceTool({
    name: "give_hint",
    description: "Show the next progressive hint for the current coding lesson.",
    parameters: z.object({}),
    async execute() {
      const result = showNextHint();
      setTutorNote(result.hint);

      return {
        ok: true,
        ...result,
      };
    },
  });
}

export function createRevealSolutionTool({
  getEditorElement,
  getState,
  revealSolution,
  runCursor,
  setTutorNote,
}: Pick<
  CreateCodingToolOptions,
  "getEditorElement" | "getState" | "revealSolution" | "runCursor" | "setTutorNote"
>) {
  return defineVoiceTool({
    name: "reveal_solution",
    description: "Replace the editor with the lesson solution only after the student asks for it.",
    parameters: z.object({}),
    async execute() {
      const editor = getEditorElement();
      const lesson = getState().lesson;

      await runCursor(
        {
          element: editor,
          pulseElement: editor,
        },
        async () => {
          revealSolution();
        },
        {
          easing: "smooth",
          from: "previous",
        },
      );

      const message =
        "Solution revealed. Read it once, then try resetting and writing it yourself.";
      setTutorNote(message);

      return {
        ok: true,
        lesson: lesson.id,
        solution: lesson.solution,
        message,
      };
    },
  });
}

export function createResetCodeTool({
  getResetButton,
  resetCode,
  runCursor,
  setTutorNote,
}: Pick<CreateCodingToolOptions, "getResetButton" | "resetCode" | "runCursor" | "setTutorNote">) {
  return defineVoiceTool({
    name: "reset_code",
    description: "Reset the visible editor back to the starter code for the current lesson.",
    parameters: z.object({}),
    async execute() {
      const button = getResetButton();

      await runCursor(
        {
          element: button,
          pulseElement: button,
        },
        async () => {
          resetCode();
        },
        {
          easing: "smooth",
          from: "previous",
        },
      );

      const message = "Code reset. Try rebuilding the solution one small step at a time.";
      setTutorNote(message);

      return { ok: true, message };
    },
  });
}

export function createChangeLessonTool({
  getLessonButton,
  runCursor,
  setLesson,
  setTutorNote,
}: Pick<CreateCodingToolOptions, "getLessonButton" | "runCursor" | "setLesson" | "setTutorNote">) {
  return defineVoiceTool({
    name: "change_lesson",
    description: "Switch between beginner coding lessons in this demo.",
    parameters: z.object({
      lesson: z.enum(CODING_LESSON_IDS),
    }),
    async execute({ lesson }) {
      const target = getLessonButton(lesson);

      await runCursor(
        {
          element: target,
          pulseElement: target,
        },
        async () => {
          setLesson(lesson);
        },
        {
          easing: "smooth",
          from: "previous",
        },
      );

      const nextLesson = getCodingLesson(lesson);
      const message = `Switched to ${nextLesson.title}.`;
      setTutorNote(message);

      return {
        ok: true,
        lesson,
        title: nextLesson.title,
        message,
      };
    },
  });
}

export function createSetTutorNoteTool({
  setTutorNote,
}: Pick<CreateCodingToolOptions, "setTutorNote">) {
  return defineVoiceTool({
    name: "set_tutor_note",
    description: "Show a short beginner-friendly explanation, feedback note, or Socratic question.",
    parameters: z.object({
      message: z.string().min(1).max(500),
    }),
    async execute({ message }) {
      setTutorNote(message);
      return { ok: true, message };
    },
  });
}

export function createGetVisibleScreenItemsTool() {
  return defineVoiceTool({
    name: "get_visible_screen_items",
    description:
      "Inspect visible text, headings, controls, and landmarks on the current screen before pointing at something.",
    parameters: z.object({}),
    async execute() {
      const items = getVisibleScreenItems().slice(0, 40);

      return {
        ok: true,
        itemCount: items.length,
        items: items.map(({ element: _element, normalizedText: _normalizedText, ...item }) => item),
      };
    },
  });
}

export function createMoveCursorTool({
  runCursor,
  setTutorNote,
}: Pick<CreateCodingToolOptions, "runCursor" | "setTutorNote">) {
  return defineVoiceTool({
    name: "move_cursor",
    description:
      "Move the visible cursor to a viewport landmark or normalized screen coordinate without changing app state.",
    parameters: z.object({
      position: z
        .enum(Object.keys(SCREEN_LANDMARKS) as [ScreenLandmark, ...ScreenLandmark[]])
        .optional(),
      xPercent: z.number().min(0).max(1).optional(),
      yPercent: z.number().min(0).max(1).optional(),
      note: z.string().min(1).max(220).optional(),
    }),
    async execute({ position = "center", xPercent, yPercent, note }) {
      const landmark = SCREEN_LANDMARKS[position];
      const x = Math.round(window.innerWidth * (xPercent ?? landmark.x));
      const y = Math.round(window.innerHeight * (yPercent ?? landmark.y));
      const message = note ?? `Moving to the ${position.replace("-", " ")} of the screen.`;

      await runCursor({ point: { x, y } }, async () => undefined, {
        easing: "smooth",
        from: "previous",
      });
      setTutorNote(message);

      return {
        ok: true,
        point: { x, y },
        message,
      };
    },
  });
}

export function createPointAtScreenTargetTool({
  runCursor,
  setTutorNote,
}: Pick<CreateCodingToolOptions, "runCursor" | "setTutorNote">) {
  return defineVoiceTool({
    name: "point_at_screen_target",
    description:
      "Point the cursor at visible text, a button, heading, code, or another visible screen item that matches a phrase.",
    parameters: z.object({
      query: z.string().min(1).max(120),
      note: z.string().min(1).max(300).optional(),
    }),
    async execute({ query, note }) {
      const bestMatch = findBestVisibleScreenItem(query);

      if (!bestMatch) {
        const visibleItems = getVisibleScreenItems().slice(0, 12);
        const message = `I could not find "${query}" on the visible screen.`;
        setTutorNote(message);

        return {
          ok: false,
          message,
          visibleItems: visibleItems.map(
            ({ element: _element, normalizedText: _normalizedText, ...item }) => item,
          ),
        };
      }

      const { item } = bestMatch;
      const message = note ?? `This is the ${item.role} that best matches "${query}".`;

      await runCursor(
        {
          element: item.element,
          pulseElement: item.element,
        },
        async () => undefined,
        {
          easing: "smooth",
          from: "previous",
        },
      );
      setTutorNote(message);

      return {
        ok: true,
        message,
        target: {
          id: item.id,
          role: item.role,
          text: item.text,
          rect: item.rect,
        },
      };
    },
  });
}
