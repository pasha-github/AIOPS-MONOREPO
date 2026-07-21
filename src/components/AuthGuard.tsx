"use client";

import { getStoredAccessToken, redirectToLogin } from "@/app/login/loginlogic";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const validateSession = () => {
      const token = getStoredAccessToken();

      if (!token) {
        setIsReady(false);
        redirectToLogin(router);
        return false;
      }

      setIsReady(true);
      return true;
    };

    validateSession();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "access_token") {
        return;
      }

      validateSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        validateSession();
      }
    };

    const handleWindowFocus = () => {
      validateSession();
    };

    const intervalId = window.setInterval(() => {
      validateSession();
    }, 1000);

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
