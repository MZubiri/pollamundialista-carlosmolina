import express from "import express"; // wait, let's fix this import
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
    // Default fallback
    return { exact: 3, outcome: 1, fail: 0 };
  }
}

// Scoring logic with configurable weights
function calculatePoints(homePred, awayPred, homeActual, awayActual, weights) {
  if (homeActual === null || awayActual === null || homePred === null || awayPred === null) {
    return 0;
  }
  
  // Exact score = weights.exact (default 3)
  if (homePred === homeActual && awayPred === awayActual) {
    return weights.exact;
  }
  
  // Winner/Draw match = weights.outcome (default 1)
  const predDiff = homePred - awayPred;
  const actualDiff = homeActual - awayActual;
  
  if (
    (predDiff > 0 && actualDiff > 0) || // Home win predicted and happened
    (predDiff < 0 && actualDiff < 0) || // Away win predicted and happened
    (predDiff === 0 && actualDiff === 0) // Draw predicted and happened
  ) {
    return weights.outcome;
  }
  
  return weights.fail;
}

// English to Spanish Team Name Map for Football API Sync
const teamTranslations = {
  "Mexico": "México",
  "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur",
  "Korea Republic": "Corea del Sur",
  "Czechia": "República Checa",
  "Czech Republic": "República Checa",
  "Canada": "Canadá",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Qatar": "Catar",
  "Switzerland": "Suiza",
  "Brazil": "Brasil",
  "Morocco": "Marruecos",
  "Haiti": "Haití",
  "Scotland": "Escocia",
  "United States": "Estados Unidos",
  "USA": "Estados Unidos",
  "Paraguay": "Paraguay",
  "Australia": "Australia",
  "Turkey": "Turquía",
  "Türkiye": "Turquía",
  "Germany": "Alemania",
  "Curacao": "Curazao",
  "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil",
  "Ecuador": "Ecuador",
  "Netherlands": "Países Bajos",
  "Japan": "Japón",
  "Sweden": "Suecia",
  "Tunisia": "Túnez",
  "Belgium": "Bélgica",
  "Egypt": "Egipto",
  "Iran": "Irán",
  "New Zealand": "Nueva Zelanda",
  "Spain": "España",
  "Cape Verde": "Cabo Verde",
  "Saudi Arabia": "Arabia Saudita",
  "Uruguay": "Uruguay",
  "France": "Francia",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Argentina": "Argentina",
  "Algeria": "Argelia",
  "Austria": "Austria",
  "Jordan": "Jordania",
  "Portugal": "Portugal",
  "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbekistán",
  "Colombia": "Colombia",
  "England": "Inglaterra",
  "Croatia": "Croacia",
  "Ghana": "Ghana",
  "Panama": "Panamá",
};

// API Endpoints

// 1. Get Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const participants = await dbAll("SELECT * FROM participants");
    const matches = await dbAll("SELECT * FROM matches");
    const predictions = await dbAll("SELECT * FROM predictions");
    const weights = await getSettings();

    // Map predictions by participant
    const predictionsByParticipant = {};
    predictions.forEach((pred) => {
      if (!predictionsByParticipant[pred.participant_id]) {
        predictionsByParticipant[pred.participant_id] = [];
      }
      predictionsByParticipant[pred.participant_id].push(pred);
    });

    const leaderboard = participants.map((p) => {
      const pPreds = predictionsByParticipant[p.id] || [];
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

      return {
        id: p.id,
        name: p.name,
        totalPoints,
        stats: {
          exact: exactMatches,
          winner: winnerMatches,
          failed: failedMatches,
          totalPredicted: pPreds.filter(pred => pred.home_pred !== null && pred.away_pred !== null).length
        }
      };
    });

    // Sort: 1st by Points desc, 2nd by name asc
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.name.localeCompare(b.name, "es");
    });

    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard query error:", error);
    res.status(500).json({ error: "Failed to load leaderboard." });
  }
});

// 2. Get all participants
app.get("/api/participants", async (req, res) => {
  try {
    const participants = await dbAll("SELECT * FROM participants ORDER BY name ASC");
    res.json(participants);
  } catch (error) {
    res.status(500).json({ error: "Failed to load participants." });
  }
});

// 3. Get single participant predictions and points
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

    res.json({
      id: participant.id,
      name: participant.name,
      predictions: detailedPredictions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load participant detail." });
  }
});

// 4. Update participant name
app.put("/api/participants/:id", async (req, res) => {
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

// 5. Update participant's predictions (bulk)
app.put("/api/participants/:id/predictions", async (req, res) => {
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

// 6. Get all matches
app.get("/api/matches", async (req, res) => {
  try {
    const matches = await dbAll("SELECT * FROM matches ORDER BY id ASC");
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "Failed to load matches." });
  }
});

// 7. Update match result (actual score)
app.put("/api/matches/:id", async (req, res) => {
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

// 8. Get Points Settings
app.get("/api/settings", async (req, res) => {
  try {
    const weights = await getSettings();
    res.json(weights);
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings." });
  }
});

// 9. Update Points Settings
app.put("/api/settings", async (req, res) => {
  const { exact, outcome, fail } = req.body;

  if (exact === undefined || outcome === undefined || fail === undefined) {
    return res.status(400).json({ error: "All setting values (exact, outcome, fail) are required." });
  }

  try {
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_exact', ?)", [parseInt(exact)]);
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_outcome', ?)", [parseInt(outcome)]);
    await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('points_fail', ?)", [parseInt(fail)]);
    res.json({ message: "Settings updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings." });
  }
});

// 10. Sync match results with Live API
app.post("/api/matches/sync", async (req, res) => {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: "API Key (FOOTBALL_API_KEY) is not configured in environment.",
    });
  }

  try {
    const response = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": apiKey },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `API sync failed: ${errText}` });
    }

    const data = await response.json();
    const apiMatches = data.matches || [];
    
    const dbMatches = await dbAll("SELECT * FROM matches");
    let updatedCount = 0;

    for (const apiMatch of apiMatches) {
      if (apiMatch.status === "FINISHED" && apiMatch.score && apiMatch.score.fullTime) {
        const homeApiName = apiMatch.homeTeam.name;
        const awayApiName = apiMatch.awayTeam.name;
        
        const homeDbName = teamTranslations[homeApiName] || homeApiName;
        const awayDbName = teamTranslations[awayApiName] || awayApiName;

        const match = dbMatches.find(
          (m) =>
            (m.home_team === homeDbName && m.away_team === awayDbName) ||
            (homeDbName.includes(m.home_team) && awayDbName.includes(m.away_team))
        );

        if (match) {
          const apiHomeScore = apiMatch.score.fullTime.home;
          const apiAwayScore = apiMatch.score.fullTime.away;

          if (
            match.home_actual !== apiHomeScore ||
            match.away_actual !== apiAwayScore
          ) {
            await dbRun(
              "UPDATE matches SET home_actual = ?, away_actual = ? WHERE id = ?",
              [apiHomeScore, apiAwayScore, match.id]
            );
            updatedCount++;
          }
        }
      }
    }

    res.json({
      message: `API Sync completed successfully! Updated ${updatedCount} matches.`,
    });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: `Failed to sync matches: ${error.message}` });
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
