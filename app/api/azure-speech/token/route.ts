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
  return { key, region };
};

export async function GET() {
  const { key, region } = resolveSpeechConfig();

  if (!key || !region) {
    return NextResponse.json(
      { error: "Azure Speech credentials are not configured." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "Failed to fetch Azure Speech token.", details: errorText },
        { status: response.status },
      );
    }

    const token = await response.text();
    return NextResponse.json({ token, region, expiresIn: 540 }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Azure Speech token request failed." },
      { status: 500 },
    );
  }
}