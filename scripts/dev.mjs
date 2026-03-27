import { spawn } from "node:child_process";

const apiPort = process.env.PORT || "3000";
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const children = [];

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev] ${name} exited with signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.log(`[dev] ${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

async function hasRunningSkinAiApi() {
  try {
    const response = await fetch(`${apiBaseUrl}/`, {
      signal: AbortSignal.timeout(1000),
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data?.message === "🧴 SkinAI API";
  } catch {
    return false;
  }
}

async function isPortInUse(port) {
  const net = await import("node:net");

  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: Number(port) });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });
  });
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 50);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const portInUse = await isPortInUse(apiPort);

if (portInUse && (await hasRunningSkinAiApi())) {
  console.log(`[dev] Reusing existing SkinAI API on ${apiBaseUrl}`);
} else if (!portInUse) {
  startProcess("api", "npm", ["run", "dev", "--workspace=apps/api"]);
} else {
  console.error(
    `[dev] Port ${apiPort} is already in use by another process. Free it or restart the API with PORT=<open-port>.`
  );
  process.exit(1);
}

startProcess("web", "npm", ["run", "dev", "--workspace=apps/web"]);
