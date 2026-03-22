import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiEnvPath = path.resolve(__dirname, "../.env");
const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: apiEnvPath });
dotenv.config({ path: rootEnvPath });

console.log("ENV loaded from:", apiEnvPath, "fallback:", rootEnvPath);
console.log("OPENAI_API_KEY exists?", !!process.env.OPENAI_API_KEY);
