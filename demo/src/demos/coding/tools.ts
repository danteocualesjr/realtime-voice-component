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

      const message = "Solution revealed. Read it once, then try resetting and writing it yourself.";
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
}: Pick<
  CreateCodingToolOptions,
  "getLessonButton" | "runCursor" | "setLesson" | "setTutorNote"
>) {
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

export function createSetTutorNoteTool({ setTutorNote }: Pick<CreateCodingToolOptions, "setTutorNote">) {
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
