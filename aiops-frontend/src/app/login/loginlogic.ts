"use client";

export const ACCESS_TOKEN_STORAGE_KEY = "access_token";

type RouterLike = {
  replace: (href: string) => void;
};

type LoginRequest = {
  username: string;
  password: string;
  baseUrl: string;
};

type LoginSuccessResponse = {
  access_token: string;
  token_type: string;
};

type LoginErrorResponse = {
  detail?: string;
};

const isLoginSuccessResponse = (
  payload: LoginSuccessResponse | LoginErrorResponse | null
): payload is LoginSuccessResponse =>
  !!payload &&
  typeof payload === "object" &&
  typeof (payload as { access_token?: unknown }).access_token === "string" &&
  (payload as { access_token: string }).access_token.trim().length > 0;

const trimTrailingSlash = (value: string) =>
  value.endsWith("/") ? value.slice(0, -1) : value;

export const getStoredAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  return token && token.trim().length > 0 ? token : null;
};

export const storeAccessToken = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
};

export const clearAccessToken = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const redirectToLogin = (router: RouterLike) => {
  router.replace("/login");
};

export const redirectToDashboard = (router: RouterLike) => {
  router.replace("/dashboard");
};

export const loginUser = async ({
  username,
  password,
  baseUrl,
}: LoginRequest): Promise<LoginSuccessResponse> => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl.trim());
  if (!normalizedBaseUrl) {
    throw new Error("Login API base URL is not configured.");
  }

  const response = await fetch(`${normalizedBaseUrl}/login`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: String(username),
      password: String(password),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | LoginSuccessResponse
    | LoginErrorResponse
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "detail" in payload
        ? String(payload.detail || "Incorrect username or password")
        : "Unable to login."
    );
  }

  if (!isLoginSuccessResponse(payload)) {
    throw new Error("Login response did not include an access token.");
  }

  return payload;
};
