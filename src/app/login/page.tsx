"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getStoredAccessToken,
  loginUser,
  redirectToDashboard,
  storeAccessToken,
} from "./loginlogic";

export default function Home() {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (getStoredAccessToken()) {
      setIsNavigating(true);
      redirectToDashboard(router);
    }
  }, [router]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isToastVisible]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      setFormError("Username and password are required.");
      setToastMessage("Username and password are required.");
      setIsToastVisible(true);
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const payload = await loginUser({
        username: normalizedUsername,
        password,
        baseUrl: trimTrailingSlash(llmManagerApiBaseUrl),
      });
      setToastMessage("Login success.");
      setIsToastVisible(true);
      storeAccessToken(payload.access_token);
      setIsNavigating(true);
      redirectToDashboard(router);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Unable to login.";
      setFormError(nextMessage);
      setToastMessage(nextMessage);
      setIsToastVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = (hasError: boolean) =>
    `h-12 w-full rounded-xl border bg-white px-4 text-[15px] text-[#1a1d25] shadow-[0_6px_18px_-16px_rgba(15,23,42,0.35)] outline-none transition placeholder:text-[#99a1b3] focus:ring-4 ${
      hasError
        ? "border-[#d12c4a] focus:border-[#d12c4a] focus:ring-[#d12c4a]/15"
        : "border-[#d7dde8] focus:border-[#4f49e2] focus:ring-[#4f49e2]/16"
    }`;

  const usernameHasError = Boolean(formError && !username.trim());
  const passwordHasError = Boolean(formError && !password);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#d8dbe4] to-[#cfd3dd] px-4 py-10">
      <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[26px] bg-white shadow-[0_20px_60px_-35px_rgba(15,17,21,0.65)]">
        <div className="flex items-center justify-center gap-4 bg-[#4f49e2] px-8 pt-3 pb-1">
          <Image
            src="/img/royal-cyber.png"
            alt="Royal Cyber"
            width={1170}
            height={390}
            className="h-[4.875rem] w-auto sm:h-[5.3625rem]"
            priority
          />
          <span className="h-7 w-px bg-white/40" />
          <span className="text-base font-semibold text-white sm:text-lg">
            AIOps for Enterprise
          </span>
        </div>

        <div className="px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f7890]">
            Secure Sign In
          </p>
          <h1 className="mt-2 text-[2rem] font-extrabold tracking-[-0.02em] text-[#0d0f14]">
            Login
          </h1>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2.5">
              <label className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#4a5263]">
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (formError) {
                    setFormError("");
                  }
                }}
                className={inputClassName(usernameHasError)}
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#4a5263]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (formError) {
                      setFormError("");
                    }
                  }}
                  onKeyUp={(event) => {
                    setIsCapsLockOn(event.getModifierState("CapsLock"));
                  }}
                  onBlur={() => setIsCapsLockOn(false)}
                  className={`${inputClassName(passwordHasError)} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a8090] transition hover:text-[#4f49e2]"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.4 10.4a3 3 0 004.2 4.2" />
                      <path d="M9.88 4.24A10.4 10.4 0 0112 4c5.5 0 9.7 3.4 11 8-0.46 1.62-1.36 3.06-2.6 4.2" />
                      <path d="M6.23 6.23C4.12 7.63 2.6 9.7 2 12c1.3 4.6 5.5 8 10 8 1.4 0 2.76-0.33 4-0.93" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {isCapsLockOn ? (
                <p className="text-xs font-medium text-[#b45309]">
                  Caps Lock is on.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#edf1f7] pt-1 text-sm text-[#4e5564]">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#c6cbd8] text-[#4f49e2] focus:ring-[#4f49e2]"
                />
                <span className="text-[13px] font-medium text-[#4e5564]">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-[13px] font-semibold text-[#11141b] transition hover:text-[#4f49e2]"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isNavigating}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#5a55ee_0%,#4f49e2_45%,#433bd6_100%)] text-[15px] font-semibold text-white shadow-[0_16px_34px_-18px_rgba(79,73,226,0.85)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_38px_-18px_rgba(79,73,226,0.95)] disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#636a78]">
            Need help?{" "}
            <span className="font-bold text-[#11141b]">
              Contact your team administrator.
            </span>
          </p>
        </div>
      </div>

      {isToastVisible ? (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div className="toast-fade relative rounded-2xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.8)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white/60">
                <span className="toast-dot-fill absolute inset-0 rounded-full bg-white" />
              </span>
              <span>{toastMessage}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl bg-white/25">
              <span className="toast-progress-bar block h-full w-full bg-white/70" />
            </div>
          </div>
        </div>
      ) : null}

      {isNavigating ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4 rounded-[28px] border border-[#e6e9f2] bg-white/90 px-10 py-9 shadow-[0_24px_70px_-34px_rgba(15,17,21,0.5)]">
            <Loader2 className="h-14 w-14 animate-spin text-[#4f49e2]" />
            <p className="text-base font-semibold text-[#171a22]">
              Loading dashboard...
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
