import { Row, Col, Spinner, Button, Card, Form } from "react-bootstrap";
import Image from "next/image";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";

const assistantId = process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID;
const messageLimit = 100;

type Message = {
  id: string;
  role: string;
  content: string;
};

const greetingMessage = { role: "assistant", content: "Sups?" };
const thinkingMessage = { role: "assistant", content: "🧠" };

export default function Index() {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState(thinkingMessage);

  useEffect(() => {
    setIsClient(true);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // clear streaming message
    setStreamingMessage(thinkingMessage);

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
        <Col md={2}>
          <img src="/icon.webp" style={{ maxWidth: "95%", padding: 3 }} />
        </Col>
        <Col>
          <OpenAIAssistantMessage
            message={greetingMessage}
            isClient={isClient}
          />

          {messages.map((m) => (
            <OpenAIAssistantMessage
              key={m.id}
              message={m}
              isClient={isClient}
            />
          ))}

          {isLoading && (
            <OpenAIAssistantMessage
              message={streamingMessage}
              isClient={isClient}
            />
          )}

          <Form onSubmit={handleSubmit} className="m-2 flex">
            <br />

            <Form.Group className="mb-3" onChange={handlePromptChange}>
              {/* <Form.Label>Legal Question</Form.Label> */}
              <Form.Control
                type="text"
                placeholder="Your legal question"
                disabled={isLoading}
                value={prompt}
              />
              <Form.Text className="text-muted"></Form.Text>
            </Form.Group>

            {isLoading ? (
              <Button disabled>
                <Spinner animation="grow" />
              </Button>
            ) : (
              <Button
                disabled={prompt.length == 0}
                type="submit"
                variant="primary"
              >
                Ask Bob
              </Button>
            )}
          </Form>
        </Col>
      </Row>

      <footer>
        <hr />

        <p>
          <small>
            This page is fictional, powered by bad AI. Don't trust any of the
            advice given here.
            <br />
            Made by <a href="https://www.evantahler.com">Evan</a> (
            <a href="https://github.com/evantahler/bobloblawlawbot.com">code</a>
            )
          </small>
        </p>
      </footer>
    </div>
  );
}

export function OpenAIAssistantMessage({ message, isClient }) {
  function displayRole(roleName) {
    switch (roleName) {
      case "user":
        return "👤";
      case "assistant":
        return "🤖";
    }
  }

  function variantRole(roleName) {
    switch (roleName) {
      case "user":
        return "secondary";
      case "assistant":
        return "secondary";
    }
  }

  return (
    <Card bg={variantRole(message.role)}>
      <Card.Body>
        <Row>
          <Col md={1}>
            <span style={{ fontSize: "200%" }}>
              {displayRole(message.role)}
            </span>
          </Col>
          <Col>
            <Card.Text>
              {isClient ? (
                <Markdown>{message.content}</Markdown>
              ) : (
                message.content
              )}
            </Card.Text>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
