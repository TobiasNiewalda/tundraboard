import { Router } from "express";
import packageJson from "../../package.json";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
  });
});
