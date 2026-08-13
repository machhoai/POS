"use client";

import { useEffect, useRef } from "react";

interface UseBarcodeScannerOptions {
  enabled?: boolean;
  minimumLength?: number;
  maximumInterKeyDelayMs?: number;
  maximumAverageKeyDelayMs?: number;
  onScan: (barcode: string) => void;
}

type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

interface EditableSnapshot {
  element: TextInputElement;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface ScanBuffer {
  value: string;
  startedAt: number;
  lastKeyAt: number;
  editable: EditableSnapshot | null;
}

const SCAN_TERMINATORS = new Set(["Enter", "Tab"]);
const MODIFIER_KEYS = new Set(["Shift", "CapsLock", "Control", "Alt", "Meta"]);
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function getEditableSnapshot(target: EventTarget | null): EditableSnapshot | null {
  const isTextArea = target instanceof HTMLTextAreaElement;
  const isTextInput = target instanceof HTMLInputElement &&
    !NON_TEXT_INPUT_TYPES.has(target.type);

  if (!isTextArea && !isTextInput) return null;

  const element = target as TextInputElement;
  return {
    element,
    value: element.value,
    selectionStart: element.selectionStart,
    selectionEnd: element.selectionEnd,
  };
}

function setNativeInputValue(element: TextInputElement, value: string): void {
  const ownSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element) as object,
    "value",
  )?.set;

  if (prototypeSetter && ownSetter !== prototypeSetter) {
    prototypeSetter.call(element, value);
  } else if (ownSetter) {
    ownSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function restoreEditable(snapshot: EditableSnapshot | null): void {
  if (!snapshot?.element.isConnected) return;

  setNativeInputValue(snapshot.element, snapshot.value);
  snapshot.element.dispatchEvent(new Event("input", { bubbles: true }));

  if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    snapshot.element.setSelectionRange(
      snapshot.selectionStart,
      snapshot.selectionEnd,
    );
  }
}

/**
 * Listen for keyboard-wedge barcode scanners without requiring a focused input.
 * A scan is identified by a fast character burst followed by Enter or Tab.
 */
export function useBarcodeScanner({
  enabled = true,
  minimumLength = 3,
  maximumInterKeyDelayMs = 100,
  maximumAverageKeyDelayMs = 50,
  onScan,
}: UseBarcodeScannerOptions): void {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef<ScanBuffer | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = null;
      return;
    }

    const resetBuffer = (): void => {
      bufferRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return;

      const now = performance.now();
      const current = bufferRef.current;

      if (SCAN_TERMINATORS.has(event.key)) {
        if (!current || current.value.length < minimumLength) {
          resetBuffer();
          return;
        }

        const characterIntervals = Math.max(1, current.value.length - 1);
        const averageDelay = (current.lastKeyAt - current.startedAt) /
          characterIntervals;

        if (
          now - current.lastKeyAt <= maximumInterKeyDelayMs &&
          averageDelay <= maximumAverageKeyDelayMs
        ) {
          event.preventDefault();
          event.stopPropagation();
          restoreEditable(current.editable);
          onScanRef.current(current.value);
        }

        resetBuffer();
        return;
      }

      // Keyboard-wedge scanners can emit standalone Shift events for uppercase
      // letters. They are part of the same scan and must not clear the buffer.
      if (MODIFIER_KEYS.has(event.key)) return;

      if (
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        resetBuffer();
        return;
      }

      if (!current || now - current.lastKeyAt > maximumInterKeyDelayMs) {
        bufferRef.current = {
          value: event.key,
          startedAt: now,
          lastKeyAt: now,
          editable: getEditableSnapshot(event.target),
        };
        return;
      }

      bufferRef.current = {
        ...current,
        value: `${current.value}${event.key}`,
        lastKeyAt: now,
      };
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", resetBuffer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", resetBuffer);
      resetBuffer();
    };
  }, [
    enabled,
    maximumAverageKeyDelayMs,
    maximumInterKeyDelayMs,
    minimumLength,
  ]);
}
