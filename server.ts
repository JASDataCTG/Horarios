import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route: Check OR-Tools Status
  app.get("/api/ortools-status", (req, res) => {
    const py = spawn("python3", ["-c", "import ortools; print(ortools.__version__)"]);
    let output = "";
    let errorOutput = "";

    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    py.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    py.on("close", (code) => {
      if (code === 0) {
        res.json({
          ready: true,
          solver: "Google OR-Tools CP-SAT",
          version: output.trim(),
          pythonVersion: process.version
        });
      } else {
        res.json({
          ready: false,
          error: errorOutput.trim() || "Python ortools module not detected"
        });
      }
    });
  });

  // API Route: Solve Timetabling with Google OR-Tools CP-SAT
  app.post("/api/solve-ortools", (req, res) => {
    const payload = req.body;
    if (!payload || !payload.entries) {
      return res.status(400).json({ error: "Missing entries in request body" });
    }

    const solverProcess = spawn("python3", ["solver_ortools.py"]);
    let stdoutData = "";
    let stderrData = "";

    solverProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    solverProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    solverProcess.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({
          error: "Solver process exited with error code " + code,
          details: stderrData || stdoutData
        });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        res.json(parsed);
      } catch (parseErr: any) {
        res.status(500).json({
          error: "Failed to parse solver JSON output",
          raw: stdoutData,
          details: parseErr.message
        });
      }
    });

    // Write input payload to stdin and close stream
    solverProcess.stdin.write(JSON.stringify(payload));
    solverProcess.stdin.end();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Academic Timetabling Server running with Google OR-Tools on http://0.0.0.0:${PORT}`);
  });
}

startServer();
