import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function POST(request: NextRequest) {
  const newMessage = await request.json();

  // if no thread id then create a new openai thread
  if (newMessage.threadId == null) {
    const thread = await openai.beta.threads.create();
    newMessage.threadId = thread.id;
  }

  // add new message to thread
  await openai.beta.threads.messages.create(newMessage.threadId, {
    role: "user",
    content: newMessage.content,
  });

  // create a run
  const run = openai.beta.threads.runs.createAndStream(newMessage.threadId, {
    assistant_id: newMessage.assistantId,
    stream: true,
  });

  const stream = run.toReadableStream();
  return new Response(stream);
}

async function GET(request: NextRequest) {
  // get thread id
  const searchParams = request.nextUrl.searchParams;
  const threadId = searchParams.get("threadId");
  const messageLimit = searchParams.get("messageLimit");

  if (threadId == null) {
    throw Error("Missing threadId");
  }

  if (messageLimit == null) {
    throw Error("Missing messageLimit");
  }

  // get thread and messages
  const threadMessages = await openai.beta.threads.messages.list(threadId, {
    limit: parseInt(messageLimit),
  });

  // only transmit the data that we need
  const cleanMessages = threadMessages.data.map((m) => {
    return {
      id: m.id,
      role: m.role,
      content: m.content[0].type == "text" ? m.content[0].text.value : "",
      createdAt: m.created_at,
    };
  });

  // reverse chronology
  cleanMessages.reverse();

  // return back to client
  return NextResponse.json(cleanMessages);
}

export default function handler(req: NextRequest): Promise<Response> {
  if (req.method === "POST") {
    return POST(req);
  } else if (req.method === "GET") {
    return GET(req);
  } else {
    throw new Error("not implemented");
  }
}
