import { trimTrailingSlash } from "@/config/agent";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseUrl = trimTrailingSlash(searchParams.get("baseUrl") ?? "");

  if (!baseUrl) {
    return NextResponse.json(
      { detail: "Vertex token base URL is required." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/vertex/config/token`, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: "Unable to fetch Vertex token." },
      { status: 502 }
    );
  }
}
