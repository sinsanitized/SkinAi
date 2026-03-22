import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiEnvPath = path.resolve(__dirname, "../.env");
const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: apiEnvPath });
dotenv.config({ path: rootEnvPath });

export const envStatus = {
  loadedEnvPath: fs.existsSync(apiEnvPath)
    ? apiEnvPath
    : fs.existsSync(rootEnvPath)
    ? rootEnvPath
    : "not found",
  fallbackEnvPath: rootEnvPath,
  hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
};
