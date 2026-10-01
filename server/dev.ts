// Local development only: Vercel imports the app from api/index.ts instead.
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
