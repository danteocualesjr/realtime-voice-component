import { createServer } from "node:http";

const port = Number(process.env.DEMO_SESSION_PORT ?? process.env.DEMO_TOKEN_PORT ?? 3211);
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", (error) => {
      reject(error);
    });
  });
}

async function readJsonBody(request) {
  const body = await readBody(request);
  if (body.length === 0) {
    return {};
  }

  return JSON.parse(body.toString("utf8"));
}

async function handleSpeakRequest(request, response) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, {
      error: "Missing ELEVENLABS_API_KEY in the environment.",
    });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const text = typeof payload.text === "string" ? payload.text.trim() : "";

    if (!text) {
      sendJson(response, 400, { error: "Missing text to synthesize." });
      return;
    }

    if (text.length > 900) {
      sendJson(response, 400, { error: "Text must be 900 characters or fewer." });
      return;
    }

    const voiceId =
      typeof process.env.ELEVENLABS_VOICE_ID === "string" && process.env.ELEVENLABS_VOICE_ID.trim()
        ? process.env.ELEVENLABS_VOICE_ID.trim()
        : DEFAULT_ELEVENLABS_VOICE_ID;
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          model_id: ELEVENLABS_MODEL_ID,
          text,
          voice_settings: {
            similarity_boost: 0.75,
            stability: 0.45,
          },
        }),
      },
    );

    if (!elevenLabsResponse.ok) {
      response.writeHead(elevenLabsResponse.status, {
        "Content-Type": elevenLabsResponse.headers.get("content-type") ?? "text/plain; charset=utf-8",
      });
      response.end(await elevenLabsResponse.text());
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": elevenLabsResponse.headers.get("content-type") ?? "audio/mpeg",
    });
    response.end(Buffer.from(await elevenLabsResponse.arrayBuffer()));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected ElevenLabs TTS failure.",
    });
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/speak") {
    await handleSpeakRequest(request, response);
    return;
  }

  if (request.method !== "POST" || requestUrl.pathname !== "/session") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, {
      error: "Missing OPENAI_API_KEY in the environment.",
    });
    return;
  }

  try {
    const contentType = request.headers["content-type"];
    const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body: request,
      duplex: "half",
    });

    if (!realtimeResponse.ok) {
      response.writeHead(realtimeResponse.status, {
        "Content-Type": realtimeResponse.headers.get("content-type") ?? "text/plain; charset=utf-8",
      });
      response.end(await realtimeResponse.text());
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        realtimeResponse.headers.get("content-type") ?? "application/sdp; charset=utf-8",
    });
    response.end(await realtimeResponse.text());
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected session server failure.",
    });
  }
});

server.listen(port, () => {
  console.log(`Demo session server listening on http://localhost:${port}`);
});
