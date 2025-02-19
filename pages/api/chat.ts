import { openAIApiKey } from "@/utils";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

const handler = async (req: NextRequest) => {
  const reqBody = await req.json();
  const rawRes = await fetch(`https://api.openai.com/v1/chat/completions`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIApiKey}`,
    },
    method: "POST",
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: reqBody.messages,
      temperature: 0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stream: true,
    }),
  });
  if (!rawRes.ok) {
    return new Response(rawRes.body, {
      status: rawRes.status,
      statusText: rawRes.statusText,
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const streamParser = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta?.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };
      const parser = createParser(streamParser);
      for await (const chunk of rawRes.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return new Response(stream);
};

export default handler;
