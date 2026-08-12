// Day-1 placeholder. Backend Dev 1 replaces this with the real Express + TypeScript
// scaffold (middleware, routers, Prisma) per the Team Implementation Guide, Week 1.
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", service: "backend" } });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on port ${PORT}`);
});
