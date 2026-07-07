import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const KNOCKOUT_DEADLINE =
  process.env.KNOCKOUT_PREDICTIONS_DEADLINE || "2026-07-09T15:00:00-05:00";
const KNOCKOUT_FIXTURE_VERSION = "cuartos_2026_07_07_v1";

app.use(cors());
app.use(express.json());

// Open database connection
const dbPath = path.join(__dirname, "db", "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to SQLite database at:", dbPath);
  }
});

// Helper functions for Database Promises
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const defaultKnockoutMatches = [
  { id: 73, stage: "Dieciseisavos", match_order: 1, home_team: "Alemania", away_team: "Paraguay" },
  { id: 74, stage: "Dieciseisavos", match_order: 2, home_team: "Francia", away_team: "Suecia" },
  { id: 75, stage: "Dieciseisavos", match_order: 3, home_team: "Sudáfrica", away_team: "Canadá" },
  { id: 76, stage: "Dieciseisavos", match_order: 4, home_team: "Países Bajos", away_team: "Marruecos" },
  { id: 77, stage: "Dieciseisavos", match_order: 5, home_team: "Portugal", away_team: "Croacia" },
  { id: 78, stage: "Dieciseisavos", match_order: 6, home_team: "Suiza", away_team: "Argelia" },
  { id: 79, stage: "Dieciseisavos", match_order: 7, home_team: "Estados Unidos", away_team: "Bosnia y Herzegovina" },
  { id: 80, stage: "Dieciseisavos", match_order: 8, home_team: "Bélgica", away_team: "Senegal" },
  { id: 81, stage: "Dieciseisavos", match_order: 9, home_team: "Brasil", away_team: "Japón" },
  { id: 82, stage: "Dieciseisavos", match_order: 10, home_team: "Costa de Marfil", away_team: "Noruega" },
  { id: 83, stage: "Dieciseisavos", match_order: 11, home_team: "México", away_team: "Ecuador" },
  { id: 84, stage: "Dieciseisavos", match_order: 12, home_team: "Inglaterra", away_team: "RD Congo" },
  { id: 85, stage: "Dieciseisavos", match_order: 13, home_team: "Argentina", away_team: "Cabo Verde" },
  { id: 86, stage: "Dieciseisavos", match_order: 14, home_team: "Australia", away_team: "Egipto" },
  { id: 87, stage: "Dieciseisavos", match_order: 15, home_team: "España", away_team: "Austria" },
  { id: 88, stage: "Dieciseisavos", match_order: 16, home_team: "Colombia", away_team: "Ghana" },
  { id: 89, stage: "Octavos", match_order: 17, home_team: "Canadá", away_team: "Marruecos" },
  { id: 90, stage: "Octavos", match_order: 18, home_team: "Paraguay", away_team: "Francia" },
  { id: 91, stage: "Octavos", match_order: 19, home_team: "Brasil", away_team: "Noruega" },
  { id: 92, stage: "Octavos", match_order: 20, home_team: "México", away_team: "Inglaterra" },
  { id: 93, stage: "Octavos", match_order: 21, home_team: "Portugal", away_team: "España" },
  { id: 94, stage: "Octavos", match_order: 22, home_team: "Estados Unidos", away_team: "Bélgica" },
  { id: 95, stage: "Octavos", match_order: 23, home_team: "Argentina", away_team: "Egipto" },
  { id: 96, stage: "Octavos", match_order: 24, home_team: "Suiza", away_team: "Colombia" },
  { id: 97, stage: "Cuartos", match_order: 25, home_team: "Francia", away_team: "Marruecos" },
  { id: 98, stage: "Cuartos", match_order: 26, home_team: "España", away_team: "Bélgica" },
  { id: 99, stage: "Cuartos", match_order: 27, home_team: "Noruega", away_team: "Inglaterra" },
  { id: 100, stage: "Cuartos", match_order: 28, home_team: "Argentina", away_team: "Suiza" },
];

async function getKnockoutDeadline() {
  try {
    const row = await dbGet("SELECT value FROM settings WHERE key = 'knockout_deadline'");
    if (row && row.value) {
      return row.value;
    }
  } catch (e) {
    console.error("Error reading knockout_deadline:", e);
  }
  return KNOCKOUT_DEADLINE;
}

async function isKnockoutLocked() {
  const deadline = await getKnockoutDeadline();
  return Date.now() >= new Date(deadline).getTime();
}

function parseScore(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) return NaN;
  return parsed;
}

async function ensureKnockoutTables() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS knockout_matches (
      id INTEGER PRIMARY KEY,
      stage TEXT NOT NULL,
      match_order INTEGER NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_actual INTEGER,
      away_actual INTEGER
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS knockout_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      knockout_match_id INTEGER NOT NULL,
      home_pred INTEGER,
      away_pred INTEGER,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(participant_id, knockout_match_id),
      FOREIGN KEY(participant_id) REFERENCES participants(id),
      FOREIGN KEY(knockout_match_id) REFERENCES knockout_matches(id)
    )
  `);

  const fixtureVersion = await dbGet("SELECT value FROM settings WHERE key = 'knockout_fixture_version'");
  if (fixtureVersion?.value !== KNOCKOUT_FIXTURE_VERSION) {
    for (const match of defaultKnockoutMatches) {
      await dbRun(
        `INSERT INTO knockout_matches
          (id, stage, match_order, home_team, away_team, home_actual, away_actual)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)
         ON CONFLICT(id)
         DO UPDATE SET
          stage = excluded.stage,
          match_order = excluded.match_order,
          home_team = excluded.home_team,
          away_team = excluded.away_team`,
        [match.id, match.stage, match.match_order, match.home_team, match.away_team]
      );
    }

    await dbRun(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('knockout_fixture_version', ?)",
      [KNOCKOUT_FIXTURE_VERSION]
    );
    await dbRun(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('knockout_deadline', ?)",
      [KNOCKOUT_DEADLINE]
    );
  }
}

const dbReady = ensureKnockoutTables().catch((error) => {
  console.error("Knockout table initialization error:", error);
  throw error;
});

// Authentication middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  if (authHeader && authHeader === adminPassword) {
    next();
  } else {
    res.status(401).json({ error: "No autorizado. Contraseña incorrecta." });
  }
}

// Retrieve dynamic points settings
async function getSettings() {
  try {
    const rows = await dbAll("SELECT * FROM settings");
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = parseInt(r.value);
    });
    return {
      exact: settings.points_exact !== undefined ? settings.points_exact : 3,
      outcome: settings.points_outcome !== undefined ? settings.points_outcome : 1,
      fail: settings.points_fail !== undefined ? settings.points_fail : 0,
    };
  } catch (e) {
    return { exact: 3, outcome: 1, fail: 0 };
  }
}

// Scoring logic with configurable weights
function calculatePoints(homePred, awayPred, homeActual, awayActual, weights) {
  if (homeActual === null || awayActual === null || homePred === null || awayPred === null) {
    return 0;
  }
  
  if (homePred === homeActual && awayPred === awayActual) {
    return weights.exact;
  }
  
  const predDiff = homePred - awayPred;
  const actualDiff = homeActual - awayActual;
  
  if (
    (predDiff > 0 && actualDiff > 0) ||
    (predDiff < 0 && actualDiff < 0) ||
    (predDiff === 0 && actualDiff === 0)
  ) {
    return weights.outcome;
  }
  
  return weights.fail;
}

// API Endpoints

// 1. Get Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const participants = await dbAll("SELECT * FROM participants");
    const matches = await dbAll("SELECT * FROM matches");
    const predictions = await dbAll("SELECT * FROM predictions");
    const knockoutMatches = await dbAll("SELECT * FROM knockout_matches");
    const knockoutPredictions = await dbAll("SELECT * FROM knockout_predictions");
    const weights = await getSettings();

    const predictionsByParticipant = {};
    predictions.forEach((pred) => {
      if (!predictionsByParticipant[pred.participant_id]) {
        predictionsByParticipant[pred.participant_id] = [];
      }
      predictionsByParticipant[pred.participant_id].push(pred);
    });

    const knockoutPredictionsByParticipant = {};
    knockoutPredictions.forEach((pred) => {
      if (!knockoutPredictionsByParticipant[pred.participant_id]) {
        knockoutPredictionsByParticipant[pred.participant_id] = [];
      }
      knockoutPredictionsByParticipant[pred.participant_id].push(pred);
    });

    const leaderboard = participants.map((p) => {
      const pPreds = predictionsByParticipant[p.id] || [];
      const pKnockoutPreds = knockoutPredictionsByParticipant[p.id] || [];
      let totalPoints = 0;
      let exactMatches = 0;
      let winnerMatches = 0;
      let failedMatches = 0;

      pPreds.forEach((pred) => {
        const match = matches.find((m) => m.id === pred.match_id);
        if (match && match.home_actual !== null && match.away_actual !== null) {
          const pts = calculatePoints(
            pred.home_pred,
            pred.away_pred,
            match.home_actual,
            match.away_actual,
            weights
          );
          totalPoints += pts;
          if (pts === weights.exact) exactMatches++;
          else if (pts === weights.outcome) winnerMatches++;
          else failedMatches++;
        }
      });

      pKnockoutPreds.forEach((pred) => {
        const match = knockoutMatches.find((m) => m.id === pred.knockout_match_id);
        if (match && match.home_actual !== null && match.away_actual !== null) {
          const pts = calculatePoints(
            pred.home_pred,
            pred.away_pred,
            match.home_actual,
            match.away_actual,
            weights
          );
          totalPoints += pts;
          if (pts === weights.exact) exactMatches++;
          else if (pts === weights.outcome) winnerMatches++;
          else failedMatches++;
        }
      });

      return {
        id: p.id,
        name: p.name,
        totalPoints,
        stats: {
          exact: exactMatches,
          winner: winnerMatches,
          failed: failedMatches,
          totalPredicted:
            pPreds.filter(pred => pred.home_pred !== null && pred.away_pred !== null).length +
            pKnockoutPreds.filter(pred => pred.home_pred !== null && pred.away_pred !== null).length
        }
      };
    });

    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.name.localeCompare(b.name, "es");
    });

    let previousPoints = null;
    let previousRank = 0;
    leaderboard.forEach((row) => {
      if (row.totalPoints !== previousPoints) {
        previousRank += 1;
        previousPoints = row.totalPoints;
      }
      row.rank = previousRank;
    });

    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard query error:", error);
    res.status(500).json({ error: "Failed to load leaderboard." });
  }
});

// 1b. Get Leaderboard History (Position tracking step-by-step)
app.get("/api/leaderboard/history", async (req, res) => {
  try {
    const participants = await dbAll("SELECT * FROM participants");
    const matches = await dbAll("SELECT * FROM matches");
    const predictions = await dbAll("SELECT * FROM predictions");
    const knockoutMatches = await dbAll("SELECT * FROM knockout_matches");
    const knockoutPredictions = await dbAll("SELECT * FROM knockout_predictions");
    const weights = await getSettings();

    // Sort played matches chronologically
    const playedGroupMatches = matches
      .filter((m) => m.home_actual !== null && m.away_actual !== null)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({
        id: m.id,
        isKnockout: false,
        label: `P${m.id}`,
        name: `${m.home_team} vs ${m.away_team}`,
        stage: `Grupo ${m.group_name}`
      }));

    const playedKnockoutMatches = knockoutMatches
      .filter((m) => m.home_actual !== null && m.away_actual !== null)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({
        id: m.id,
        isKnockout: true,
        label: `${m.stage === "Dieciseisavos" ? "D" : m.stage === "Octavos" ? "O" : "C"}${m.match_order || m.id}`,
        name: `${m.home_team} vs ${m.away_team}`,
        stage: m.stage
      }));

    const playedMatches = [...playedGroupMatches, ...playedKnockoutMatches];

    // Map predictions by participant and match for quick lookup
    const groupPredsMap = {};
    predictions.forEach((p) => {
      groupPredsMap[`${p.participant_id}_${p.match_id}`] = p;
    });

    const knockoutPredsMap = {};
    knockoutPredictions.forEach((p) => {
      knockoutPredsMap[`${p.participant_id}_${p.knockout_match_id}`] = p;
    });

    // Initialize tracking for each participant
    const historyData = participants.map((p) => ({
      id: p.id,
      name: p.name,
      points: [0], // Step 0 points
      ranks: [1]   // Step 0 rank
    }));

    // Step-by-step points computation
    playedMatches.forEach((match) => {
      historyData.forEach((p) => {
        let matchPoints = 0;
        if (match.isKnockout) {
          const pred = knockoutPredsMap[`${p.id}_${match.id}`];
          const actual = knockoutMatches.find((m) => m.id === match.id);
          if (pred && actual) {
            matchPoints = calculatePoints(
              pred.home_pred,
              pred.away_pred,
              actual.home_actual,
              actual.away_actual,
              weights
            );
          }
        } else {
          const pred = groupPredsMap[`${p.id}_${match.id}`];
          const actual = matches.find((m) => m.id === match.id);
          if (pred && actual) {
            matchPoints = calculatePoints(
              pred.home_pred,
              pred.away_pred,
              actual.home_actual,
              actual.away_actual,
              weights
            );
          }
        }
        const prevPoints = p.points[p.points.length - 1];
        p.points.push(prevPoints + matchPoints);
      });

      // Calculate ranks for this step
      const stepStandings = historyData.map((p, idx) => ({
        idx,
        points: p.points[p.points.length - 1],
        name: p.name
      }));

      stepStandings.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.name.localeCompare(b.name, "es");
      });

      let currentRank = 0;
      let prevPoints = null;
      stepStandings.forEach((standing) => {
        if (standing.points !== prevPoints) {
          currentRank += 1;
          prevPoints = standing.points;
        }
        historyData[standing.idx].ranks.push(currentRank);
      });
    });

    res.json({
      matches: playedMatches,
      history: historyData
    });
  } catch (error) {
    console.error("Leaderboard history error:", error);
    res.status(500).json({ error: "Failed to load leaderboard history." });
  }
});

// 2. Validate Admin Password
app.post("/api/admin/verify", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Contraseña incorrecta." });
  }
});

// 3. Get all participants
app.get("/api/participants", async (req, res) => {
  try {
    const participants = await dbAll("SELECT * FROM participants ORDER BY name ASC");
    res.json(participants);
  } catch (error) {
    res.status(500).json({ error: "Failed to load participants." });
  }
});

// 4. Get single participant predictions and points
app.get("/api/participants/:id", async (req, res) => {
  try {
    const participant = await dbGet("SELECT * FROM participants WHERE id = ?", [req.params.id]);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found." });
    }

    const matches = await dbAll("SELECT * FROM matches ORDER BY id ASC");
    const predictions = await dbAll(
      "SELECT * FROM predictions WHERE participant_id = ?",
      [participant.id]
    );
    const knockoutMatches = await dbAll("SELECT * FROM knockout_matches ORDER BY match_order ASC");
    const knockoutPredictions = await dbAll(
      "SELECT * FROM knockout_predictions WHERE participant_id = ?",
      [participant.id]
    );
    const weights = await getSettings();

    const detailedPredictions = matches.map((m) => {
      const pred = predictions.find((p) => p.match_id === m.id) || {
        home_pred: null,
        away_pred: null,
      };

      const points = calculatePoints(
        pred.home_pred,
        pred.away_pred,
        m.home_actual,
        m.away_actual,
        weights
      );

      return {
        matchId: m.id,
        groupName: m.group_name,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        homeActual: m.home_actual,
        awayActual: m.away_actual,
        homePred: pred.home_pred,
        awayPred: pred.away_pred,
        points,
      };
    });

    const detailedKnockoutPredictions = knockoutMatches.map((m) => {
      const pred = knockoutPredictions.find((p) => p.knockout_match_id === m.id) || {
        home_pred: null,
        away_pred: null,
      };

      const points = calculatePoints(
        pred.home_pred,
        pred.away_pred,
        m.home_actual,
        m.away_actual,
        weights
      );

      return {
        matchId: m.id,
        stage: m.stage,
        matchOrder: m.match_order,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        homeActual: m.home_actual,
        awayActual: m.away_actual,
        homePred: pred.home_pred,
        awayPred: pred.away_pred,
        points,
      };
    });

    res.json({
      id: participant.id,
      name: participant.name,
      predictions: detailedPredictions,
      knockoutPredictions: detailedKnockoutPredictions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load participant detail." });
  }
});

// 5. Update participant name (ADMIN ONLY)
app.put("/api/participants/:id", requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Name is required." });
  }

  try {
    const existing = await dbGet("SELECT id FROM participants WHERE name = ? AND id != ?", [
      name.trim(),
      req.params.id,
    ]);
    if (existing) {
      return res.status(400).json({ error: "Name is already taken." });
    }

    await dbRun("UPDATE participants SET name = ? WHERE id = ?", [name.trim(), req.params.id]);
    res.json({ message: "Participant updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update participant." });
  }
});

// 6. Update participant's predictions (ADMIN ONLY)
app.put("/api/participants/:id/predictions", requireAdmin, async (req, res) => {
  const { predictions } = req.body;
  if (!Array.isArray(predictions)) {
    return res.status(400).json({ error: "Predictions array is required." });
  }

  try {
    for (const p of predictions) {
      const home = p.home_pred === "" || p.home_pred === null ? null : parseInt(p.home_pred);
      const away = p.away_pred === "" || p.away_pred === null ? null : parseInt(p.away_pred);

      await dbRun(
        "UPDATE predictions SET home_pred = ?, away_pred = ? WHERE participant_id = ? AND match_id = ?",
        [home, away, req.params.id, p.match_id]
      );
    }

    res.json({ message: "Predictions updated successfully." });
  } catch (error) {
    console.error("Error updating predictions:", error);
    res.status(500).json({ error: "Failed to update predictions." });
  }
});

// 7. Get all matches
app.get("/api/matches", async (req, res) => {
  try {
    const matches = await dbAll("SELECT * FROM matches ORDER BY id ASC");
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "Failed to load matches." });
  }
});

// 8. Update match result (actual score) (ADMIN ONLY)
app.put("/api/matches/:id", requireAdmin, async (req, res) => {
  const { home_actual, away_actual } = req.body;
  
  const home = home_actual === "" || home_actual === null ? null : parseInt(home_actual);
  const away = away_actual === "" || away_actual === null ? null : parseInt(away_actual);

  try {
    await dbRun("UPDATE matches SET home_actual = ?, away_actual = ? WHERE id = ?", [
      home,
      away,
      req.params.id,
    ]);
    res.json({ message: "Match score updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update match score." });
  }
});

// 9. Get Points Settings
app.get("/api/settings", async (req, res) => {
  try {
    const weights = await getSettings();
    const knockoutDeadline = await getKnockoutDeadline();
    res.json({ ...weights, knockoutDeadline });
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings." });
  }
});

// 10. Update Points Settings (ADMIN ONLY)
app.put("/api/settings", requireAdmin, async (req, res) => {
  const { exact, outcome, fail, knockoutDeadline } = req.body;

  if (exact === undefined || outcome === undefined || fail === undefined) {
    return res.status(400).json({ error: "All setting values (exact, outcome, fail) are required." });
  }

  try {
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_exact', ?)", [parseInt(exact)]);
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_outcome', ?)", [parseInt(outcome)]);
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_fail', ?)", [parseInt(fail)]);
    if (knockoutDeadline !== undefined) {
      await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('knockout_deadline', ?)", [knockoutDeadline]);
    }
    res.json({ message: "Settings updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings." });
  }
});

// 11. Get knockout prediction form data (ADMIN ONLY)
app.get("/api/knockout", requireAdmin, async (req, res) => {
  try {
    const matches = await dbAll("SELECT * FROM knockout_matches ORDER BY match_order ASC");
    const participants = await dbAll("SELECT id, name FROM participants ORDER BY name ASC");
    const predictionCounts = await dbAll(`
      SELECT participant_id, COUNT(*) AS count
      FROM knockout_predictions
      WHERE home_pred IS NOT NULL AND away_pred IS NOT NULL
      GROUP BY participant_id
    `);

    res.json({
      deadline: await getKnockoutDeadline(),
      locked: await isKnockoutLocked(),
      matches,
      participants,
      predictionCounts,
    });
  } catch (error) {
    console.error("Knockout load error:", error);
    res.status(500).json({ error: "Failed to load knockout data." });
  }
});

// 12. Get one participant's knockout predictions (ADMIN ONLY)
app.get("/api/knockout/predictions/:participantId", requireAdmin, async (req, res) => {
  try {
    const participant = await dbGet("SELECT id, name FROM participants WHERE id = ?", [
      req.params.participantId,
    ]);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found." });
    }

    const rows = await dbAll(
      "SELECT * FROM knockout_predictions WHERE participant_id = ?",
      [participant.id]
    );

    res.json({
      participant,
      predictions: rows,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load knockout predictions." });
  }
});

// 13. Save knockout predictions before the deadline (ADMIN ONLY)
app.post("/api/knockout/predictions", requireAdmin, async (req, res) => {
  if (await isKnockoutLocked()) {
    return res.status(403).json({
      error: "El plazo para enviar pronósticos de eliminatorias ya terminó.",
    });
  }

  const { participant_id, predictions } = req.body;
  if (!participant_id || !Array.isArray(predictions)) {
    return res.status(400).json({ error: "Participant and predictions are required." });
  }

  try {
    const participant = await dbGet("SELECT id FROM participants WHERE id = ?", [participant_id]);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found." });
    }

    const matches = await dbAll("SELECT id FROM knockout_matches");
    const validMatchIds = new Set(matches.map((m) => m.id));

    for (const pred of predictions) {
      if (!validMatchIds.has(Number(pred.match_id))) {
        return res.status(400).json({ error: "Invalid knockout match." });
      }

      const home = parseScore(pred.home_pred);
      const away = parseScore(pred.away_pred);
      if ((home === null && away !== null) || (home !== null && away === null) || Number.isNaN(home) || Number.isNaN(away)) {
        return res.status(400).json({
          error: "Los pronósticos deben tener marcadores numéricos válidos.",
        });
      }
    }

    for (const pred of predictions) {
      const home = parseScore(pred.home_pred);
      const away = parseScore(pred.away_pred);
      if (home === null || away === null) {
        continue;
      }
      await dbRun(
        `INSERT INTO knockout_predictions
          (participant_id, knockout_match_id, home_pred, away_pred, submitted_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(participant_id, knockout_match_id)
         DO UPDATE SET
          home_pred = excluded.home_pred,
          away_pred = excluded.away_pred,
          submitted_at = CURRENT_TIMESTAMP`,
        [participant.id, Number(pred.match_id), home, away]
      );
    }

    res.json({ message: "Pronósticos de eliminatorias guardados con éxito." });
  } catch (error) {
    console.error("Knockout prediction save error:", error);
    res.status(500).json({ error: "Failed to save knockout predictions." });
  }
});

// 14. Update knockout match teams/result (ADMIN ONLY)
app.put("/api/knockout/matches/:id", requireAdmin, async (req, res) => {
  const { home_team, away_team, home_actual, away_actual } = req.body;
  const homeActual = parseScore(home_actual);
  const awayActual = parseScore(away_actual);

  if (!home_team || !away_team || home_team.trim() === "" || away_team.trim() === "") {
    return res.status(400).json({ error: "Both team names are required." });
  }

  if (Number.isNaN(homeActual) || Number.isNaN(awayActual)) {
    return res.status(400).json({ error: "Invalid score values." });
  }

  try {
    const result = await dbRun(
      `UPDATE knockout_matches
       SET home_team = ?, away_team = ?, home_actual = ?, away_actual = ?
       WHERE id = ?`,
      [home_team.trim(), away_team.trim(), homeActual, awayActual, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Knockout match not found." });
    }

    res.json({ message: "Knockout match updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update knockout match." });
  }
});

// Production: Serve built frontend assets
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Backend server is running in development mode. Serve frontend with Vite.");
  });
}

dbReady
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(() => {
    process.exit(1);
  });
