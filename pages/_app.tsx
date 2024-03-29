import Head from "next/head";
import { Container, Row, Col } from "react-bootstrap";
import { Analytics } from "@vercel/analytics/react";
import "../scss/site.scss";

export default function SITE({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width" />
        <title>Bob Loblaw's Law Bot</title>
      </Head>

      <Container>
        <Row>
          <Col md={12}>
            <br />
            <Component {...pageProps} />
          </Col>
        </Row>
      </Container>

      <Analytics />
    </>
  );
}
