"use client";

import { useEffect } from "react";

export default function UserManagementPage() {
  useEffect(() => {
    const currentOrigin = window.location.origin;
    const referrer = document.referrer;

    if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        if (referrerUrl.origin === currentOrigin) {
          window.location.replace(
            `${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`
          );
          return;
        }
      } catch {}
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.replace("/dashboard");
  }, []);

  return null;
}
