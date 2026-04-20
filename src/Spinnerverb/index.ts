export type SpinnerVerbKind = "running" | "received";

const SPINNER_VERB_BANKS: Record<SpinnerVerbKind, readonly string[]> = {
  running: [
    "Running",
    "Executing",
    "Invoking",
    "Processing",
    "Calling",
    "Launching",
    "Triggering",
    "Working on",
  ],
  received: [
    "Received",
    "Fetched",
    "Retrieved",
    "Collected",
    "Returned",
    "Delivered",
    "Captured",
    "Gathered",
  ],
};

export const getSpinnerVerb = (
  kind: SpinnerVerbKind,
  sequence = 0
): string => {
  const bank = SPINNER_VERB_BANKS[kind];
  const safeIndex = Math.abs(sequence) % bank.length;
  return bank[safeIndex];
};

export const buildSpinnerLabel = ({
  kind,
  subject,
  suffix = "",
  sequence = 0,
}: {
  kind: SpinnerVerbKind;
  subject: string;
  suffix?: string;
  sequence?: number;
}): string => {
  const verb = getSpinnerVerb(kind, sequence);
  const cleanSubject = subject.trim();
  const cleanSuffix = suffix.trim();

  return [verb, cleanSubject, cleanSuffix].filter(Boolean).join(" ");
};
