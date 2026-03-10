"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push("/dashboard");
  };

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
          <h1 className="text-3xl font-extrabold text-[#0d0f14]">Login</h1>
          <p className="mt-2 text-base text-[#5b606c]">
            Welcome back! Please enter your details.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#171a22]">
                Email<span className="text-[#d12c4a]">*</span>
              </label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#d4d8e3] px-4 text-[15px] text-[#1a1d25] outline-none transition focus:border-[#4f49e2] focus:ring-4 focus:ring-[#4f49e2]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#171a22]">
                Password<span className="text-[#d12c4a]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-[#d4d8e3] px-4 pr-12 text-[15px] text-[#1a1d25] outline-none transition focus:border-[#4f49e2] focus:ring-4 focus:ring-[#4f49e2]/20"
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#4e5564]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#c6cbd8] text-[#4f49e2] focus:ring-[#4f49e2]"
                />
                Remember me
              </label>
              <a
                href="#"
                className="font-bold text-[#11141b] hover:text-[#4f49e2]"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#4f49e2] text-[15px] font-semibold text-white shadow-[0_10px_30px_-15px_rgba(79,73,226,0.75)] transition hover:translate-y-[-1px] hover:bg-[#433bd6]"
            >
              Login
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
    </div>
  );
}
