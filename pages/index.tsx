import { Row, Col, Spinner } from "react-bootstrap";
import { useState } from "react";
import Markdown from "react-markdown";

const assistantId = process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID;
const messageLimit = 100;

type Message = {
  id: string;
  role: string;
  content: string;
};

const greetingMessage = {
  role: "assistant",
  content: "Hello! I am Bob Loblaw's Law Bot. How can I help you today?",
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState({
    role: "assistant",
    content: "_Thinking..._",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // clear streaming message
    setStreamingMessage({
      role: "assistant",
      content: "_Thinking..._",
    });

    // add busy indicator
    setIsLoading(true);

    // add user message to list of messages
    setMessages([
      ...messages,
      {
        id: "temp_user",
        role: "user",
        content: prompt,
      },
    ]);
    setPrompt("");

    // post new message to server and stream OpenAI Assistant response
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assistantId: assistantId,
        threadId: threadId,
        content: prompt,
      }),
    });

    let contentSnapshot = "";
    let newThreadId: string;

    // this code can be simplified when more browsers support async iteration
    // see https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#consuming_a_fetch_using_asynchronous_iteration
    let reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const strChunk = new TextDecoder().decode(value).trim();
      const strServerEvents = strChunk.split("\n");

      for (const strServerEvent of strServerEvents) {
        const serverEvent = JSON.parse(strServerEvent);
        // console.log(serverEvent);
        switch (serverEvent.event) {
          // create new message
          case "thread.message.created":
            newThreadId = serverEvent.data.thread_id;
            setThreadId(serverEvent.data.thread_id);
            break;

          // update streaming message content
          case "thread.message.delta":
            contentSnapshot += serverEvent.data.delta.content[0].text.value;
            const newStreamingMessage = {
              ...streamingMessage,
              content: contentSnapshot,
            };
            setStreamingMessage(newStreamingMessage);
            break;
        }
      }
    }

    // refetch all of the messages from the OpenAI Assistant thread
    const messagesResponse = await fetch(
      "/api/assistant?" +
        new URLSearchParams({
          threadId: newThreadId,
          messageLimit: `${messageLimit}`,
        })
    );
    const allMessages = await messagesResponse.json();
    setMessages(allMessages);

    setIsLoading(false);
  }

  function handlePromptChange(e: React.FormEvent<HTMLInputElement>) {
    setPrompt(e.target["value"]);
  }

  return (
    <div>
      <header>
        <h1>Bob Loblaw's Law Bot</h1>
      </header>

      <Row>
        <Col md={2}>ICON HERE</Col>
        <Col>stuff </Col>
      </Row>

      <main>
        <div className="flex flex-col bg-slate-200 shadow-md relative">
          <OpenAIAssistantMessage message={greetingMessage} />
          {messages.map((m) => (
            <OpenAIAssistantMessage key={m.id} message={m} />
          ))}
          {isLoading && <OpenAIAssistantMessage message={streamingMessage} />}
          <form onSubmit={handleSubmit} className="m-2 flex">
            <input
              disabled={isLoading}
              className="border rounded w-full py-2 px-3 text-gray-70"
              onChange={handlePromptChange}
              value={prompt}
              placeholder="prompt"
            />
            {isLoading ? (
              <button
                disabled
                className="ml-2  bg-blue-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                <Spinner />
              </button>
            ) : (
              <button
                disabled={prompt.length == 0}
                className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                SEND
              </button>
            )}
          </form>
        </div>
      </main>

      <footer>
        <hr />
        <p>
          This page is fictional, and you really shouldn't trust any of the
          advice given here
        </p>
      </footer>
    </div>
  );
}

export function OpenAIAssistantMessage({ message }) {
  function displayRole(roleName) {
    switch (roleName) {
      case "user":
        return "👤";
      case "assistant":
        return "🤖";
    }
  }
  return (
    <div className="flex rounded text-gray-700 text-center bg-white px-4 py-2 m-2 shadow-md">
      <div className="text-4xl">{displayRole(message.role)}</div>
      <div className="mx-4 text-left overflow-auto openai-text">
        <Markdown>{message.content}</Markdown>
      </div>
    </div>
  );
}
