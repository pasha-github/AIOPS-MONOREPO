"use client";

import { useCallback, useRef } from "react";
import type { StreamStep } from "../dashboard.types";
import {
    extractFunctionCalls,
    extractFunctionResponses,
    extractVisibleTextFromParts,
    formatMilestoneDetails,
    mergeStreamingText,
    normalizeToolName,
    parseSsePayload,
    summarizeStreamError,
} from "./help.chat";

export function useStreamingChat({
    appName,
    userId,
    adkBaseUrl,
    setStreamingText,
    setStreamSteps,
    setIsStreamingReply,
    setSendError,
}: any) {
    const streamTargetTextRef = useRef("");
    const streamRenderedTextRef = useRef("");
    const streamAnimationFrameRef = useRef<number | null>(null);
    const streamStepCounterRef = useRef(0);
    const streamStepsRef = useRef<StreamStep[]>([]);

    // ✅ Reset
    const resetStreamingText = useCallback(() => {
        if (streamAnimationFrameRef.current) {
            cancelAnimationFrame(streamAnimationFrameRef.current);
            streamAnimationFrameRef.current = null;
        }
        streamTargetTextRef.current = "";
        streamRenderedTextRef.current = "";
        setStreamingText("");
    }, [setStreamingText]);

    // ✅ Animate typing
    const animateStreamingText = useCallback(() => {
        if (streamAnimationFrameRef.current) return;

        const tick = () => {
            const target = streamTargetTextRef.current;
            const current = streamRenderedTextRef.current;

            if (current === target) {
                streamAnimationFrameRef.current = null;
                return;
            }

            const step = 20;
            const next = target.slice(0, current.length + step);

            streamRenderedTextRef.current = next;
            setStreamingText(next);

            streamAnimationFrameRef.current = requestAnimationFrame(tick);
        };

        streamAnimationFrameRef.current = requestAnimationFrame(tick);
    }, [setStreamingText]);

    const updateStreamingTargetText = useCallback(
        (text: string) => {
            streamTargetTextRef.current = text;
            animateStreamingText();
        },
        [animateStreamingText]
    );

    // ✅ Steps
    const addRunningStep = useCallback((label: string, details?: any) => {
        const formatted = formatMilestoneDetails(details);

        setStreamSteps((prev: StreamStep[]) => {
            const next = [...prev];

            streamStepCounterRef.current += 1;

            next.push({
                id: `step-${streamStepCounterRef.current}`,
                label,
                status: "running",
                details: formatted,
            });

            streamStepsRef.current = next;
            return next;
        });
    }, [setStreamSteps]);

    const completeLastRunningStep = useCallback(() => {
        setStreamSteps((prev: StreamStep[]) => {
            const next = [...prev];
            const last = next.length - 1;

            if (last >= 0) {
                next[last] = { ...next[last], status: "done" };
            }

            streamStepsRef.current = next;
            return next;
        });
    }, [setStreamSteps]);

    // ✅ Process SSE
    const processSseFrame = useCallback((frame: string): boolean => {
        const raw = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");

        if (!raw) return true;
        if (raw === "[DONE]") {
            completeLastRunningStep();
            return true;
        }

        const payload = parseSsePayload(raw);
        if (!payload) return true;

        if (payload.error) {
            setSendError(summarizeStreamError(payload.error));
            return false;
        }

        const parts = payload.content?.parts || [];
        const text = extractVisibleTextFromParts(parts);
        const calls = extractFunctionCalls(parts);
        const responses = extractFunctionResponses(parts);

        calls.forEach((c) => {
            const toolName = typeof c.name === "string" ? c.name : "";
            addRunningStep(`Running ${normalizeToolName(toolName)}`);
        });

        responses.forEach((r) => {
            const toolName = typeof r.name === "string" ? r.name : "";
            addRunningStep(`Received ${normalizeToolName(toolName)}`);
        });

        if (text) {
            const merged = mergeStreamingText(streamTargetTextRef.current, text);
            updateStreamingTargetText(merged);
        }

        return true;
    }, [addRunningStep, completeLastRunningStep, updateStreamingTargetText, setSendError]);

    // ✅ Start
    const startStreamingState = useCallback(() => {
        resetStreamingText();
        setStreamSteps([]);
        setIsStreamingReply(true);
    }, [resetStreamingText, setStreamSteps, setIsStreamingReply]);

    // ✅ SSE call
    const runPromptSse = useCallback(async (sessionId: string, prompt: string) => {
        const res = await fetch(`${adkBaseUrl}/run_sse`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                accept: "text/event-stream",
            },
            body: JSON.stringify({
                appName,
                userId,
                sessionId,
                streaming: true,
                newMessage: {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            }),
        });

        if (!res.body) return false;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);

            let idx;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
                const frame = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);

                const ok = processSseFrame(frame);
                if (!ok) return false;
            }
        }

        completeLastRunningStep();
        return true;
    }, [adkBaseUrl, appName, userId, processSseFrame, completeLastRunningStep]);

    return {
        runPromptSse,
        startStreamingState,
        resetStreamingText,
    };
}