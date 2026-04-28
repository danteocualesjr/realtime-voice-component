import { type UseGhostCursorReturn } from "realtime-voice-component";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { createChangeDemoTool, getInteractiveDemoPath } from "../shared/tools";
import { useSharedDemoController } from "../shared/session";
import { CODING_DEMO_INSTRUCTIONS, type CodingLessonId, type CodingRunResult } from "./config";
import {
  createChangeLessonTool,
  createGetLessonStateTool,
  createGiveHintTool,
  createResetCodeTool,
  createRevealSolutionTool,
  createRunTestsTool,
  createSetCodeTool,
  createSetTutorNoteTool,
} from "./tools";

type UseCodingDemoVoiceControllerOptions = {
  getEditorElement: () => HTMLElement | null;
  getLessonButton: (lesson: CodingLessonId) => HTMLElement | null;
  getResetButton: () => HTMLElement | null;
  getRunButton: () => HTMLButtonElement | null;
  getState: Parameters<typeof createGetLessonStateTool>[0]["getState"];
  resetCode: () => void;
  revealSolution: () => void;
  runCursor: UseGhostCursorReturn["run"];
  runTests: () => CodingRunResult;
  setCode: (code: string) => void;
  setLesson: (lesson: CodingLessonId) => void;
  setTutorNote: (message: string) => void;
  onVoiceError: (message: string) => void;
  showNextHint: () => { hint: string; hintIndex: number; exhausted: boolean };
};

export function useCodingDemoVoiceController({
  getEditorElement,
  getLessonButton,
  getResetButton,
  getRunButton,
  getState,
  resetCode,
  revealSolution,
  runCursor,
  runTests,
  setCode,
  setLesson,
  setTutorNote,
  onVoiceError,
  showNextHint,
}: UseCodingDemoVoiceControllerOptions) {
  const navigate = useNavigate();

  const tools = useMemo(
    () => [
      createGetLessonStateTool({ getState }),
      createSetCodeTool({ getEditorElement, runCursor, setCode }),
      createRunTestsTool({ getRunButton, runCursor, runTests }),
      createGiveHintTool({ showNextHint, setTutorNote }),
      createRevealSolutionTool({
        getEditorElement,
        getState,
        revealSolution,
        runCursor,
        setTutorNote,
      }),
      createResetCodeTool({ getResetButton, resetCode, runCursor, setTutorNote }),
      createChangeLessonTool({ getLessonButton, runCursor, setLesson, setTutorNote }),
      createSetTutorNoteTool({ setTutorNote }),
      createChangeDemoTool({
        getActiveDemo: () => "coding",
        getDemoTab: (demo) =>
          document.querySelector<HTMLElement>(`[data-ai-target="demo-tab-${demo}"]`),
        navigateToDemo: (demo) => {
          navigate(getInteractiveDemoPath(demo));
        },
        runCursor,
      }),
    ],
    [
      getEditorElement,
      getLessonButton,
      getResetButton,
      getRunButton,
      getState,
      navigate,
      resetCode,
      revealSolution,
      runCursor,
      runTests,
      setCode,
      setLesson,
      setTutorNote,
      onVoiceError,
      showNextHint,
    ],
  );

  const { controller, runtime } = useSharedDemoController({
    demoId: "coding",
    debug: true,
    instructions: CODING_DEMO_INSTRUCTIONS,
    onError: (error) => {
      onVoiceError(`Voice connection failed (${error.code ?? "unknown"}): ${error.message}`);
    },
    postToolResponse: false,
    tools,
  });

  return {
    controller,
    runtime,
  };
}
