import {
  CheckCircle2Icon,
  Code2Icon,
  LightbulbIcon,
  PlayIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import { GhostCursorOverlay, useGhostCursor, VoiceControlWidget } from "realtime-voice-component";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  DemoCard,
  DemoIntro,
  DemoPageShell,
  DemoSection,
  DemoWakeWordStatus,
} from "../shared/primitives";
import { useWakeWordActivation } from "../shared/wakeWord";
import {
  CODING_LESSONS,
  DEFAULT_CODING_LESSON_ID,
  buildCodingStateMessage,
  buildRunResultMessage,
  getCodingLesson,
  runCodingLessonTests,
  type CodingLessonId,
  type CodingRunResult,
} from "./config";
import { useCodingDemoVoiceController } from "./controller";

const LESSON_BUTTON_CLASS =
  "h-auto min-h-20 w-full justify-start rounded-[16px] border-border bg-panel px-4 py-4 text-left shadow-none";

export function CodingDemoPage() {
  const [lessonId, setLessonIdState] = useState<CodingLessonId>(DEFAULT_CODING_LESSON_ID);
  const [code, setCodeState] = useState(() => getCodingLesson(DEFAULT_CODING_LESSON_ID).starterCode);
  const [hintIndex, setHintIndex] = useState(0);
  const [testRun, setTestRun] = useState<CodingRunResult | null>(null);
  const [tutorNote, setTutorNoteState] = useState(
    "Try saying: run my tests, give me a hint, explain my code, or switch to arrays.",
  );
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const runButtonRef = useRef<HTMLButtonElement | null>(null);
  const resetButtonRef = useRef<HTMLButtonElement | null>(null);
  const lessonButtonRefs = useRef<Record<CodingLessonId, HTMLButtonElement | null>>({
    "reverse-string": null,
    "sum-array": null,
  });
  const stateRef = useRef({
    code,
    hintIndex,
    lesson: getCodingLesson(lessonId),
    testRun,
    tutorNote,
  });
  const tutorAudioRef = useRef<HTMLAudioElement | null>(null);
  const tutorSpeechRequestRef = useRef(0);
  const { cursorState, run } = useGhostCursor();

  const speakTutorNote = useCallback(async (message: string) => {
    if (!message.trim()) {
      return;
    }

    const requestId = tutorSpeechRequestRef.current + 1;
    tutorSpeechRequestRef.current = requestId;

    try {
      tutorAudioRef.current?.pause();
      if (tutorAudioRef.current?.src) {
        URL.revokeObjectURL(tutorAudioRef.current.src);
      }

      const response = await fetch("/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        return;
      }

      const audioBlob = await response.blob();
      if (tutorSpeechRequestRef.current !== requestId) {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      tutorAudioRef.current = audio;
      audio.addEventListener(
        "ended",
        () => {
          URL.revokeObjectURL(audioUrl);
          if (tutorAudioRef.current === audio) {
            tutorAudioRef.current = null;
          }
        },
        { once: true },
      );
      await audio.play();
    } catch {
      // Keep the written tutor note usable even if speech synthesis is unavailable.
    }
  }, []);

  const setTutorNote = useCallback((message: string) => {
    setTutorNoteState(message);
    void speakTutorNote(message);
  }, [speakTutorNote]);

  const handleVoiceError = useCallback((message: string) => {
    setTutorNoteState(message);
  }, []);

  const setCode = useCallback((nextCode: string) => {
    setCodeState(nextCode);
    setTestRun(null);
  }, []);

  const setLesson = useCallback((nextLessonId: CodingLessonId) => {
    const nextLesson = getCodingLesson(nextLessonId);

    setLessonIdState(nextLessonId);
    setCodeState(nextLesson.starterCode);
    setHintIndex(0);
    setTestRun(null);
    setTutorNote(`New lesson: ${nextLesson.title}. ${nextLesson.prompt}`);
  }, [setTutorNote]);

  const lesson = getCodingLesson(lessonId);
  stateRef.current = {
    code,
    hintIndex,
    lesson,
    testRun,
    tutorNote,
  };

  const runTests = useCallback(() => {
    const result = runCodingLessonTests(stateRef.current.code, stateRef.current.lesson);
    setTestRun(result);
    setTutorNote(buildRunResultMessage(result));
    return result;
  }, [setTutorNote]);

  const showNextHint = useCallback(() => {
    const current = stateRef.current;
    const nextIndex = Math.min(current.hintIndex + 1, current.lesson.hints.length);
    const exhausted = current.hintIndex >= current.lesson.hints.length;
    const hint = exhausted
      ? "You have seen every hint. Try running the tests, then compare your approach to the solution if you are still blocked."
      : (current.lesson.hints[nextIndex - 1] ?? "Try breaking the problem into one smaller step.");

    if (!exhausted) {
      setHintIndex(nextIndex);
    }

    return {
      hint,
      hintIndex: nextIndex,
      exhausted,
    };
  }, []);

  const revealSolution = useCallback(() => {
    setCodeState(stateRef.current.lesson.solution);
    setTestRun(null);
    setHintIndex(stateRef.current.lesson.hints.length);
  }, []);

  const resetCode = useCallback(() => {
    setCodeState(stateRef.current.lesson.starterCode);
    setTestRun(null);
    setHintIndex(0);
  }, []);

  const getState = useCallback(() => stateRef.current, []);
  const getEditorElement = useCallback(() => editorRef.current, []);
  const getRunButton = useCallback(() => runButtonRef.current, []);
  const getResetButton = useCallback(() => resetButtonRef.current, []);
  const getLessonButton = useCallback(
    (targetLessonId: CodingLessonId) => lessonButtonRefs.current[targetLessonId],
    [],
  );

  const { controller, runtime } = useCodingDemoVoiceController({
    getEditorElement,
    getLessonButton,
    getResetButton,
    getRunButton,
    getState,
    resetCode,
    revealSolution,
    runCursor: run,
    runTests,
    setCode,
    setLesson,
    setTutorNote,
    onVoiceError: handleVoiceError,
    showNextHint,
  });

  useEffect(() => {
    if (!runtime.connected) {
      return;
    }

    controller.sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildCodingStateMessage({
              code,
              hintIndex,
              lesson,
              testRun,
              tutorNote,
            }),
          },
        ],
      },
    });
  }, [code, controller, hintIndex, lesson, runtime.connected, testRun, tutorNote]);

  const canActivateFromWakeWord = !runtime.connected && runtime.activity !== "connecting";

  const activateWidgetFromWakeWord = useCallback(() => {
    if (!canActivateFromWakeWord) {
      return false;
    }

    void controller.connect();
    return true;
  }, [canActivateFromWakeWord, controller]);

  const wakeWord = useWakeWordActivation({
    enabled: true,
    canActivateWidget: canActivateFromWakeWord,
    onWakeWord: () => activateWidgetFromWakeWord(),
  });

  useEffect(() => {
    return () => {
      tutorAudioRef.current?.pause();
      if (tutorAudioRef.current?.src) {
        URL.revokeObjectURL(tutorAudioRef.current.src);
      }
    };
  }, []);

  return (
    <DemoPageShell>
      <GhostCursorOverlay state={cursorState} />

      <DemoCard className="overflow-hidden">
        <DemoIntro
          eyebrow="Coding Tutor"
          title="Duolingo for coding, with a voice tutor."
          body="A beginner JavaScript lesson where the assistant can inspect the lesson state, run tests, offer hints, switch exercises, and update the visible tutor panel."
          emphasis={
            <>
              Try <strong>run my tests</strong>, <strong>give me a hint</strong>,{" "}
              <strong>explain what I should do</strong>, or <strong>switch to arrays</strong>.
            </>
          }
        />

        <DemoSection
          heading="Voice Tutor"
          aside={<DemoWakeWordStatus wakeWord={wakeWord} />}
          description="The voice assistant is constrained to app-owned learning actions rather than free-form browser control."
        >
          <Card className="rounded-[18px] bg-muted/45 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <LightbulbIcon className="size-4" />
              </span>
              <div className="grid gap-1">
                <p className="text-sm font-semibold tracking-[-0.01em]">Tutor note</p>
                <p className="text-sm leading-6 text-muted-foreground">{tutorNote}</p>
              </div>
            </CardContent>
          </Card>
        </DemoSection>

        <DemoSection heading="Lesson" description="Choose a small exercise, then solve it in the editor.">
          <div className="grid gap-3 sm:grid-cols-2">
            {CODING_LESSONS.map((candidate) => (
              <Button
                key={candidate.id}
                ref={(node) => {
                  lessonButtonRefs.current[candidate.id] = node;
                }}
                type="button"
                variant={candidate.id === lesson.id ? "default" : "outline"}
                className={cn(LESSON_BUTTON_CLASS, candidate.id === lesson.id && "border-primary")}
                onClick={() => {
                  setLesson(candidate.id);
                }}
              >
                <span className="grid gap-1.5">
                  <span className="text-base font-semibold tracking-[-0.02em]">{candidate.title}</span>
                  <span className="whitespace-normal text-sm leading-5 opacity-75">{candidate.concept}</span>
                </span>
              </Button>
            ))}
          </div>

          <Card className="rounded-[18px] shadow-none">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">JavaScript</Badge>
                <Badge variant="outline">{lesson.functionName}</Badge>
                <Badge variant="outline">
                  {hintIndex}/{lesson.hints.length} hints used
                </Badge>
              </div>
              <CardTitle className="text-2xl tracking-[-0.04em]">{lesson.title}</CardTitle>
              <CardDescription className="text-base leading-7">{lesson.prompt}</CardDescription>
            </CardHeader>
          </Card>
        </DemoSection>

        <DemoSection heading="Code Editor" description="Edit the function, then run tests manually or by voice.">
          <Textarea
            ref={editorRef}
            value={code}
            spellCheck={false}
            className="min-h-[220px] resize-y rounded-[18px] bg-[#101010] p-5 font-mono text-[0.92rem] leading-7 text-[#f5f3ef] shadow-inner selection:bg-white/20"
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />

          <div className="flex flex-wrap gap-2.5">
            <Button ref={runButtonRef} type="button" size="lg" onClick={runTests}>
              <PlayIcon className="size-4" />
              Run tests
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                const result = showNextHint();
                setTutorNote(result.hint);
              }}
            >
              <LightbulbIcon className="size-4" />
              Hint
            </Button>
            <Button ref={resetButtonRef} type="button" variant="outline" size="lg" onClick={resetCode}>
              <RotateCcwIcon className="size-4" />
              Reset
            </Button>
          </div>
        </DemoSection>

        <DemoSection heading="Tests" description="The tutor can run these checks and explain the first failure.">
          <div className="grid gap-3">
            {lesson.tests.map((test, index) => {
              const result = testRun?.results[index];
              const hasRun = result !== undefined;

              return (
                <Card key={test.label} className="rounded-[16px] shadow-none">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          !hasRun && "bg-muted text-muted-foreground",
                          result?.pass && "bg-emerald-100 text-emerald-700",
                          hasRun && !result?.pass && "bg-red-100 text-red-700",
                        )}
                      >
                        {result?.pass ? (
                          <CheckCircle2Icon className="size-4" />
                        ) : hasRun ? (
                          <XCircleIcon className="size-4" />
                        ) : (
                          <Code2Icon className="size-4" />
                        )}
                      </span>
                      <div className="grid gap-1">
                        <p className="text-sm font-semibold">{test.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {lesson.functionName}({test.args.map((arg) => JSON.stringify(arg)).join(", ")}){" "}
                          {"->"}{" "}
                          {JSON.stringify(test.expected)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={result?.pass ? "default" : "outline"}>
                      {!hasRun ? "Not run" : result.pass ? "Passed" : "Needs work"}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DemoSection>

        <CardContent className="mt-10 p-0">
          <VoiceControlWidget controller={controller} snapToCorners />
        </CardContent>
      </DemoCard>
    </DemoPageShell>
  );
}
