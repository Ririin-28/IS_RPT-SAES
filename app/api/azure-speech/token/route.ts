import { NextResponse } from "next/server";

const resolveSpeechConfig = () => {
  const key =
    process.env.AZURE_SPEECH_KEY ||
    process.env.SPEECH_KEY ||
    process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY ||
    "";
  const region =
    process.env.AZURE_SPEECH_REGION ||
    process.env.SPEECH_REGION ||
    process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION ||
    "";
  const endpoint =
    process.env.AZURE_SPEECH_ENDPOINT ||
    process.env.SPEECH_ENDPOINT ||
    process.env.NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT ||
    "";
  return { key, region, endpoint };
};

const deriveRegionFromEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    const first = host.split(".")[0];
    return first || "";
  } catch {
    return "";
  }
};

export async function GET() {
  const { key, region, endpoint } = resolveSpeechConfig();
  const endpointRegion = endpoint ? deriveRegionFromEndpoint(endpoint) : "";
  const resolvedRegion = endpointRegion || region;
  const tokenUrl = endpoint
    ? new URL("sts/v1.0/issueToken", endpoint).toString()
    : resolvedRegion
      ? `https://${resolvedRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`
      : "";

  if (!key || !tokenUrl || !resolvedRegion) {
    return NextResponse.json(
      { error: "Azure Speech credentials are not configured." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("Azure Speech token request failed", {
        status: response.status,
        region: resolvedRegion,
        endpoint: endpoint || "(default)",
        keyLength: key.length,
        details: errorText,
      });
      return NextResponse.json(
        { error: "Failed to fetch Azure Speech token.", details: errorText },
        { status: response.status },
      );
    }

    const token = await response.text();
    return NextResponse.json({ token, region: resolvedRegion, expiresIn: 540 }, { status: 200 });
  } catch (error) {
    console.error("Token request failed:", error);
    return NextResponse.json(
      { error: "Azure Speech token request failed." },
      { status: 500 },
    );
  }
}