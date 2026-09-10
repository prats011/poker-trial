import { createServer } from "./server";

async function start() {
  const { app, env } = await createServer();
  await app.listen({ port: env.SERVER_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
