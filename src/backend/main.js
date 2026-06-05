import { createBackendApp } from "./app.module.js";

const port = Number(process.env.PORT ?? 3001);
const app = await createBackendApp();

await app.listen(port);
console.log(`ExampleHR Time-Off microservice listening on http://localhost:${port}`);
