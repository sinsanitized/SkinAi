import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("ENV loaded from:", path.resolve(__dirname, "../.env"));
console.log("OPENAI_API_KEY exists?", !!process.env.OPENAI_API_KEY);
