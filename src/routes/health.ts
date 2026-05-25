import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";

export const healthRouter = Router();

const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: pkg.version,
    timestamp: new Date().toISOString(),
  });
});
