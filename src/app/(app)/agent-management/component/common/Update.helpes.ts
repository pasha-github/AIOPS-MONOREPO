export const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none";

export const toSnakeCase = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

export const normalizeString = (value: string) => value.trim();

export const getErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload
  ) {
    return String((payload as any).message);
  }
  return fallback;
};
