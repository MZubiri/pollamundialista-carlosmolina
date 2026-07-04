import React, { useState, useEffect } from "react";
import {
  Trophy,
  Users,
  Settings,
  X,
  Edit2,
  Save,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  User,
  Sliders,
  Lock,
  Unlock,
  CalendarClock
} from "lucide-react";

export default function App() {
  const [view, setView] = useState("leaderboard"); // leaderboard, admin
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [participantDetail, setParticipantDetail] = useState(null);
  const [matches, setMatches] = useState([]);
  const [knockoutData, setKnockoutData] = useState(null);
  const [selectedKnockoutParticipantId, setSelectedKnockoutParticipantId] = useState("");
  const [knockoutPredChanges, setKnockoutPredChanges] = useState({});
  const [knockoutAdminChanges, setKnockoutAdminChanges] = useState({});
  const [savingKnockout, setSavingKnockout] = useState(false);
  
  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPasswordInput, setLoginPasswordInput] = useState("");
  
  // Admin states
  const [adminTab, setAdminTab] = useState("matches"); // matches, knockout, participants, settings
  const [showPastGroupMatches, setShowPastGroupMatches] = useState(false);
  const [showModalGroupStage, setShowModalGroupStage] = useState(false);
  const [showPastKnockout, setShowPastKnockout] = useState(false);
  const [showPastKnockoutPreds, setShowPastKnockoutPreds] = useState(false);
  const [showPastKnockoutDetail, setShowPastKnockoutDetail] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null); // { id, name, predictions }
  const [editPredChanges, setEditPredChanges] = useState({}); // { matchId: { homePred, awayPred } }
  const [matchScoreChanges, setMatchScoreChanges] = useState({}); // { matchId: { homeActual, awayActual } }
  const [editingNameId, setEditingNameId] = useState(null);
  const [newNameVal, setNewNameVal] = useState("");
  
  // Scoring rules settings state
  const [pointsSettings, setPointsSettings] = useState({ exact: 3, outcome: 1, fail: 0, knockoutDeadline: "" });
  const [editingSettings, setEditingSettings] = useState({ exact: 3, outcome: 1, fail: 0, knockoutDeadline: "" });
  
  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper for admin fetches
  const adminHeaders = (password = adminPassword) => {
    return {
      "Content-Type": "application/json",
      "Authorization": password
    };
  };

  // Fetch Leaderboard
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Error fetching leaderboard");
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Matches for Admin Panel
  const fetchMatches = async () => {
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Error fetching matches");
      const data = await res.json();
      setMatches(data);
      
      const initialChanges = {};
      data.forEach(m => {
        initialChanges[m.id] = {
          home_actual: m.home_actual !== null ? m.home_actual : "",
          away_actual: m.away_actual !== null ? m.away_actual : ""
        };
      });
      setMatchScoreChanges(initialChanges);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const fetchKnockout = async (password = adminPassword) => {
    try {
      const res = await fetch("/api/knockout", {
        headers: adminHeaders(password)
      });
      if (checkAuthError(res)) return;
      if (!res.ok) throw new Error("Error fetching knockout matches");
      const data = await res.json();
      setKnockoutData(data);

      const adminChanges = {};
      data.matches.forEach((m) => {
        adminChanges[m.id] = {
          home_team: m.home_team,
          away_team: m.away_team,
          home_actual: m.home_actual !== null ? m.home_actual : "",
          away_actual: m.away_actual !== null ? m.away_actual : ""
        };
      });
      setKnockoutAdminChanges(adminChanges);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const fetchKnockoutPredictions = async (participantId) => {
    if (!participantId || !knockoutData) {
      setKnockoutPredChanges({});
      return;
    }

    try {
      const res = await fetch(`/api/knockout/predictions/${participantId}`, {
        headers: adminHeaders()
      });
      if (checkAuthError(res)) return;
      if (!res.ok) throw new Error("Error fetching knockout predictions");
      const data = await res.json();
      const existingByMatch = {};
      data.predictions.forEach((p) => {
        existingByMatch[p.knockout_match_id] = p;
      });

      const nextChanges = {};
      knockoutData.matches.forEach((m) => {
        const saved = existingByMatch[m.id];
        nextChanges[m.id] = {
          home_pred: saved?.home_pred !== null && saved?.home_pred !== undefined ? saved.home_pred : "",
          away_pred: saved?.away_pred !== null && saved?.away_pred !== undefined ? saved.away_pred : ""
        };
      });
      setKnockoutPredChanges(nextChanges);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Fetch Points Settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Error fetching settings");
      const data = await res.json();
      setPointsSettings(data);
      setEditingSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  // Check 401 Unauthorized errors
  const checkAuthError = (res) => {
    if (res.status === 401) {
      addToast("Sesión de administrador no válida o contraseña incorrecta.", "error");
      setIsAdmin(false);
      setAdminPassword("");
      localStorage.removeItem("adminPassword");
      setView("leaderboard");
      return true;
    }
    return false;
  };

  // Verify stored password on load
  const verifyStoredPassword = async (savedPassword) => {
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPassword })
      });
      if (res.ok) {
        setIsAdmin(true);
        setAdminPassword(savedPassword);
      } else {
        localStorage.removeItem("adminPassword");
      }
    } catch (e) {
      localStorage.removeItem("adminPassword");
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchSettings();
    const savedPassword = localStorage.getItem("adminPassword");
    if (savedPassword) {
      verifyStoredPassword(savedPassword);
    }
  }, []);

  useEffect(() => {
    if (selectedKnockoutParticipantId) {
      fetchKnockoutPredictions(selectedKnockoutParticipantId);
    }
  }, [selectedKnockoutParticipantId, knockoutData?.matches?.length]);

  // Fetch Participant Detail when ID changes
  useEffect(() => {
    if (selectedParticipantId) {
      setShowModalGroupStage(false);
      const fetchDetail = async () => {
        try {
          const res = await fetch(`/api/participants/${selectedParticipantId}`);
          if (!res.ok) throw new Error("Error fetching participant details");
          const data = await res.json();
          setParticipantDetail(data);
        } catch (err) {
          addToast(err.message, "error");
        }
      };
      fetchDetail();
    } else {
      setParticipantDetail(null);
    }
  }, [selectedParticipantId]);

  // Login click
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginPasswordInput) return;
    
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPasswordInput })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Contraseña incorrecta");
      
      setIsAdmin(true);
      setAdminPassword(loginPasswordInput);
      localStorage.setItem("adminPassword", loginPasswordInput);
      setShowLoginModal(false);
      setLoginPasswordInput("");
      addToast("Acceso de administrador concedido.");
      
      // Navigate to admin
      setView("admin");
      fetchMatches();
      fetchSettings();
      fetchKnockout(loginPasswordInput);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPassword("");
    localStorage.removeItem("adminPassword");
    setView("leaderboard");
    addToast("Sesión de administrador cerrada.");
  };

  // Update Match Actual Score (Admin Only)
  const handleUpdateMatchScore = async (matchId) => {
    const scores = matchScoreChanges[matchId];
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          home_actual: scores.home_actual === "" ? null : scores.home_actual,
          away_actual: scores.away_actual === "" ? null : scores.away_actual
        })
      });
      if (checkAuthError(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update match score");
      addToast("Partido actualizado con éxito.");
      fetchLeaderboard();
      
      setMatches(prev => prev.map(m => m.id === matchId ? {
        ...m,
        home_actual: scores.home_actual === "" ? null : parseInt(scores.home_actual),
        away_actual: scores.away_actual === "" ? null : parseInt(scores.away_actual)
      } : m));
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Edit Participant predictions click
  const handleEditParticipantPreds = async (participantId) => {
    try {
      const res = await fetch(`/api/participants/${participantId}`);
      if (!res.ok) throw new Error("Error fetching details for editing");
      const data = await res.json();
      setEditingParticipant(data);
      
      const initialChanges = {};
      data.predictions.forEach(p => {
        initialChanges[p.matchId] = {
          home_pred: p.homePred !== null ? p.homePred : "",
          away_pred: p.awayPred !== null ? p.awayPred : ""
        };
      });
      setEditPredChanges(initialChanges);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Save Participant Predictions (Admin Only)
  const handleSaveParticipantPreds = async () => {
    if (!editingParticipant) return;
    
    const updatedPredictions = Object.keys(editPredChanges).map(matchId => ({
      match_id: parseInt(matchId),
      home_pred: editPredChanges[matchId].home_pred === "" ? null : editPredChanges[matchId].home_pred,
      away_pred: editPredChanges[matchId].away_pred === "" ? null : editPredChanges[matchId].away_pred
    }));

    try {
      const res = await fetch(`/api/participants/${editingParticipant.id}/predictions`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ predictions: updatedPredictions })
      });
      if (checkAuthError(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save predictions");
      
      addToast("Predicciones guardadas con éxito.");
      setEditingParticipant(null);
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Edit Participant Name (Admin Only)
  const handleSaveParticipantName = async (id) => {
    if (!newNameVal || newNameVal.trim() === "") return;
    try {
      const res = await fetch(`/api/participants/${id}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ name: newNameVal.trim() })
      });
      if (checkAuthError(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename participant");
      
      addToast("Participante renombrado con éxito.");
      setEditingNameId(null);
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Save Points Settings (Admin Only)
  const handleSaveSettings = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(editingSettings)
      });
      if (checkAuthError(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      
      addToast("Reglas de puntuación actualizadas.");
      setPointsSettings(editingSettings);
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const handleSaveKnockoutPredictions = async () => {
    if (!selectedKnockoutParticipantId || !knockoutData) {
      addToast("Selecciona tu participante antes de guardar.", "error");
      return;
    }

    const predictions = knockoutData.matches.map((m) => ({
      match_id: m.id,
      home_pred: knockoutPredChanges[m.id]?.home_pred,
      away_pred: knockoutPredChanges[m.id]?.away_pred
    }));

    const hasInvalid = predictions.some((p) => {
      const home = p.home_pred;
      const away = p.away_pred;
      const homeEmpty = home === "" || home === null || home === undefined;
      const awayEmpty = away === "" || away === null || away === undefined;
      if (homeEmpty && awayEmpty) return false;
      if (homeEmpty || awayEmpty) return true;
      const hNum = Number(home);
      const aNum = Number(away);
      return isNaN(hNum) || isNaN(aNum) || hNum < 0 || aNum < 0;
    });

    if (hasInvalid) {
      addToast("Completa los marcadores con números válidos (o déjalos vacíos).", "error");
      return;
    }

    setSavingKnockout(true);
    try {
      const res = await fetch("/api/knockout/predictions", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          participant_id: Number(selectedKnockoutParticipantId),
          predictions
        })
      });
      if (checkAuthError(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron guardar los pronósticos");
      addToast(data.message || "Pronósticos guardados.");
      fetchKnockout();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSavingKnockout(false);
    }
  };

  const handleUpdateKnockoutMatch = async (matchId) => {
    const changes = knockoutAdminChanges[matchId];
    try {
      const res = await fetch(`/api/knockout/matches/${matchId}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(changes)
      });
      if (checkAuthError(res)) return;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el partido");
      addToast("Partido de eliminatorias actualizado.");
      fetchKnockout();
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Group detailed predictions by Group letter
  const getGroups = (predictionsList) => {
    const groups = {};
    predictionsList.forEach((p) => {
      if (!groups[p.groupName]) {
        groups[p.groupName] = [];
      }
      groups[p.groupName].push(p);
    });
    return groups;
  };

  // Group detailed predictions by Stage name (knockout stages)
  const getKnockoutStages = (predictionsList) => {
    if (!predictionsList) return {};
    const stages = {};
    predictionsList.forEach((p) => {
      if (!stages[p.stage]) {
        stages[p.stage] = [];
      }
      stages[p.stage].push(p);
    });
    return stages;
  };

  // Filter leaderboard by search term
  const filteredLeaderboard = leaderboard.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const podium = leaderboard.slice(0, 3);
  const restOfList = filteredLeaderboard;
  const knockoutSelectedParticipant = leaderboard.find(
    (p) => p.id === Number(selectedKnockoutParticipantId)
  );
  const knockoutDeadlineText = knockoutData?.deadline
    ? new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima"
      }).format(new Date(knockoutData.deadline))
    : "";
  const knockoutPredictionCounts = {};
  knockoutData?.predictionCounts?.forEach((row) => {
    knockoutPredictionCounts[row.participant_id] = row.count;
  });
  const knockoutSubmittedParticipants = Object.values(knockoutPredictionCounts).filter(
    (count) => count === knockoutData?.matches?.length
  ).length;
  const getRankClass = (rank) => {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    return "rank-3";
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-section">
          <Trophy className="logo-icon" size={28} />
          <h1 className="app-title">Polla Mundial 2026</h1>
        </div>
        <div className="nav-actions">
          {view === "leaderboard" ? (
            <>
              {isAdmin ? (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setView("admin");
                      fetchMatches();
                      fetchSettings();
                      fetchKnockout();
                    }}
                  >
                    <Settings size={18} />
                    Panel Admin
                  </button>
                  <button className="btn btn-danger" onClick={handleAdminLogout}>
                    <Lock size={18} />
                    Cerrar Admin
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLoginModal(true)}
                >
                  <Unlock size={18} />
                  Ingresar Admin
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setView("leaderboard");
                  fetchLeaderboard();
                }}
              >
                <Users size={18} />
                Ver Tabla General
              </button>
              <button className="btn btn-danger" onClick={handleAdminLogout}>
                <Lock size={18} />
                Cerrar Admin
              </button>
            </>
          )}
        </div>
      </header>

      {/* Leaderboard View */}
      {view === "leaderboard" && (
        <>
          {/* Podium for top 3 */}
          {!loading && leaderboard.length >= 3 && searchTerm === "" && (
            <section className="podium-container">
              {/* Second Place */}
              {podium[1] && (
                <div className="podium-card second">
                  <div className={`podium-rank ${getRankClass(podium[1].rank)}`}>{podium[1].rank}</div>
                  <div className="podium-name">{podium[1].name}</div>
                  <div className="podium-points">{podium[1].totalPoints} pts</div>
                  <div className="podium-stats">
                    <span className="stat-badge">Exacto ({pointsSettings.exact}p): {podium[1].stats.exact}</span>
                    <span className="stat-badge">Ganador ({pointsSettings.outcome}p): {podium[1].stats.winner}</span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: "1rem", padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                    onClick={() => setSelectedParticipantId(podium[1].id)}
                  >
                    <Eye size={12} /> Detalle
                  </button>
                </div>
              )}

              {/* First Place */}
              {podium[0] && (
                <div className="podium-card first">
                  <div className={`podium-rank ${getRankClass(podium[0].rank)}`}>{podium[0].rank}</div>
                  <Trophy size={40} style={{ color: "hsl(var(--accent-gold))", marginBottom: "0.5rem" }} />
                  <div className="podium-name">{podium[0].name}</div>
                  <div className="podium-points">{podium[0].totalPoints} pts</div>
                  <div className="podium-stats">
                    <span className="stat-badge">Exacto ({pointsSettings.exact}p): {podium[0].stats.exact}</span>
                    <span className="stat-badge">Ganador ({pointsSettings.outcome}p): {podium[0].stats.winner}</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: "1rem", padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                    onClick={() => setSelectedParticipantId(podium[0].id)}
                  >
                    <Eye size={12} /> Detalle
                  </button>
                </div>
              )}

              {/* Third Place */}
              {podium[2] && (
                <div className="podium-card third">
                  <div className={`podium-rank ${getRankClass(podium[2].rank)}`}>{podium[2].rank}</div>
                  <div className="podium-name">{podium[2].name}</div>
                  <div className="podium-points">{podium[2].totalPoints} pts</div>
                  <div className="podium-stats">
                    <span className="stat-badge">Exacto ({pointsSettings.exact}p): {podium[2].stats.exact}</span>
                    <span className="stat-badge">Ganador ({pointsSettings.outcome}p): {podium[2].stats.winner}</span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: "1rem", padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                    onClick={() => setSelectedParticipantId(podium[2].id)}
                  >
                    <Eye size={12} /> Detalle
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Main Leaderboard Table */}
          <div className="dashboard-grid">
            <div className="table-card">
              <div className="table-header">
                <h2 className="table-title">Marcador General</h2>
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "hsl(var(--text-muted))"
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Buscar participante..."
                    className="search-input"
                    style={{ paddingLeft: "2.2rem" }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ padding: "3rem", textAlignment: "center", color: "hsl(var(--text-muted))" }}>
                  Cargando posiciones...
                </div>
              ) : (
                <table className="custom-table leaderboard-table">
                  <thead>
                    <tr>
                      <th className="rank-col">Pos.</th>
                      <th>Participante</th>
                      <th style={{ textAlign: "center" }}>Marcador Exacto ({pointsSettings.exact} pts)</th>
                      <th style={{ textAlign: "center" }}>Acierto Ganador ({pointsSettings.outcome} pts)</th>
                      <th style={{ textAlign: "center" }}>Errados ({pointsSettings.fail} pts)</th>
                      <th style={{ textAlign: "right" }}>Total Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restOfList.map((p) => (
                      <tr key={p.id} onClick={() => setSelectedParticipantId(p.id)}>
                        <td className="rank-col">#{p.rank}</td>
                        <td className="name-col">{p.name}</td>
                        <td style={{ textAlign: "center", color: "hsl(var(--primary))", fontWeight: "600" }}>
                          {p.stats.exact}
                        </td>
                        <td style={{ textAlign: "center", color: "hsl(var(--accent-gold))", fontWeight: "600" }}>
                          {p.stats.winner}
                        </td>
                        <td style={{ textAlign: "center", color: "#ff6b6b" }}>
                          {p.stats.failed}
                        </td>
                        <td className="points-col" style={{ textAlign: "right" }}>
                          {p.totalPoints} pts
                        </td>
                      </tr>
                    ))}
                    {restOfList.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "hsl(var(--text-muted))" }}>
                          No se encontraron participantes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Admin View */}
      {view === "admin" && isAdmin && (
        <div className="dashboard-grid">
          <div className="table-card" style={{ padding: "2rem" }}>
            <div className="admin-header">
              <h2 className="table-title">Panel de Administración</h2>
              <div className="admin-tab-buttons">
                <button
                  className={`btn ${adminTab === "matches" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setAdminTab("matches");
                    fetchMatches();
                    fetchKnockout();
                  }}
                >
                  Resultados Reales
                </button>
                <button
                  className={`btn ${adminTab === "knockout" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setAdminTab("knockout");
                    fetchKnockout();
                  }}
                >
                  Eliminatorias
                </button>
                <button
                  className={`btn ${adminTab === "participants" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAdminTab("participants")}
                >
                  Participantes
                </button>
                <button
                  className={`btn ${adminTab === "settings" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAdminTab("settings")}
                >
                  <Sliders size={16} /> Configuración Puntos
                </button>
              </div>
            </div>

            {/* Matches Admin Tab */}
            {adminTab === "matches" && (
              <div className="admin-match-list">
                <div className="admin-info-row">
                  <div>
                    <h3 className="table-title">Resultados reales de eliminatorias</h3>
                    <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem", marginTop: "0.35rem" }}>
                      Actualiza los cruces y marcadores reales de la fase actual. Al guardar, se recalcula el marcador general.
                    </p>
                  </div>
                  <span className="lock-badge open">Fase actual</span>
                </div>

                {knockoutData?.matches?.filter(m => m.stage === "Octavos").map((m) => (
                  <div key={m.id} className="admin-knockout-card">
                    <div>
                      <span className="match-chip">{m.stage} - Partido {m.id}</span>
                      <div className="admin-team-editors">
                        <input
                          type="text"
                          className="form-control"
                          value={knockoutAdminChanges[m.id]?.home_team ?? ""}
                          onChange={(e) =>
                            setKnockoutAdminChanges({
                              ...knockoutAdminChanges,
                              [m.id]: {
                                ...knockoutAdminChanges[m.id],
                                home_team: e.target.value
                              }
                            })
                          }
                        />
                        <span>vs</span>
                        <input
                          type="text"
                          className="form-control"
                          value={knockoutAdminChanges[m.id]?.away_team ?? ""}
                          onChange={(e) =>
                            setKnockoutAdminChanges({
                              ...knockoutAdminChanges,
                              [m.id]: {
                                ...knockoutAdminChanges[m.id],
                                away_team: e.target.value
                              }
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="admin-score-inputs">
                      <input
                        type="number"
                        min="0"
                        placeholder="L"
                        className="score-input"
                        value={knockoutAdminChanges[m.id]?.home_actual ?? ""}
                        onChange={(e) =>
                          setKnockoutAdminChanges({
                            ...knockoutAdminChanges,
                            [m.id]: {
                              ...knockoutAdminChanges[m.id],
                              home_actual: e.target.value
                            }
                          })
                        }
                      />
                      <span style={{ color: "hsl(var(--text-muted))" }}>-</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="V"
                        className="score-input"
                        value={knockoutAdminChanges[m.id]?.away_actual ?? ""}
                        onChange={(e) =>
                          setKnockoutAdminChanges({
                            ...knockoutAdminChanges,
                            [m.id]: {
                              ...knockoutAdminChanges[m.id],
                              away_actual: e.target.value
                            }
                          })
                        }
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: "0.5rem", borderRadius: "6px" }}
                        onClick={() => handleUpdateKnockoutMatch(m.id)}
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").length > 0 && (
                  <div className="past-matches-panel" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
                    <button
                      type="button"
                      className="past-matches-toggle"
                      onClick={() => setShowPastKnockout(!showPastKnockout)}
                    >
                      <span>Fase anterior (Dieciseisavos)</span>
                      <span>{showPastKnockout ? "Ocultar" : "Mostrar"} ({knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").length})</span>
                    </button>
                    {showPastKnockout && knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").map((m) => (
                      <div key={m.id} className="admin-knockout-card" style={{ marginTop: "1rem" }}>
                        <div>
                          <span className="match-chip">{m.stage} - Partido {m.id}</span>
                          <div className="admin-team-editors">
                            <input
                              type="text"
                              className="form-control"
                              value={knockoutAdminChanges[m.id]?.home_team ?? ""}
                              onChange={(e) =>
                                setKnockoutAdminChanges({
                                  ...knockoutAdminChanges,
                                  [m.id]: {
                                    ...knockoutAdminChanges[m.id],
                                    home_team: e.target.value
                                  }
                                })
                              }
                            />
                            <span>vs</span>
                            <input
                              type="text"
                              className="form-control"
                              value={knockoutAdminChanges[m.id]?.away_team ?? ""}
                              onChange={(e) =>
                                setKnockoutAdminChanges({
                                  ...knockoutAdminChanges,
                                  [m.id]: {
                                    ...knockoutAdminChanges[m.id],
                                    away_team: e.target.value
                                  }
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="admin-score-inputs">
                          <input
                            type="number"
                            min="0"
                            placeholder="L"
                            className="score-input"
                            value={knockoutAdminChanges[m.id]?.home_actual ?? ""}
                            onChange={(e) =>
                              setKnockoutAdminChanges({
                                ...knockoutAdminChanges,
                                [m.id]: {
                                  ...knockoutAdminChanges[m.id],
                                  home_actual: e.target.value
                                }
                              })
                            }
                          />
                          <span style={{ color: "hsl(var(--text-muted))" }}>-</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="V"
                            className="score-input"
                            value={knockoutAdminChanges[m.id]?.away_actual ?? ""}
                            onChange={(e) =>
                              setKnockoutAdminChanges({
                                ...knockoutAdminChanges,
                                [m.id]: {
                                  ...knockoutAdminChanges[m.id],
                                  away_actual: e.target.value
                                }
                              })
                            }
                          />
                          <button
                            className="btn btn-primary"
                            style={{ padding: "0.5rem", borderRadius: "6px" }}
                            onClick={() => handleUpdateKnockoutMatch(m.id)}
                          >
                            <Save size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="past-matches-panel">
                  <button
                    type="button"
                    className="past-matches-toggle"
                    onClick={() => setShowPastGroupMatches(!showPastGroupMatches)}
                  >
                    <span>Partidos anteriores de fase de grupos</span>
                    <span>{showPastGroupMatches ? "Ocultar" : "Mostrar"} ({matches.length})</span>
                  </button>
                  {showPastGroupMatches && matches.map((m) => (
                    <div key={m.id} className="admin-match-card">
                    <div>
                      <span style={{ fontSize: "0.75rem", backgroundColor: "rgba(255,255,255,0.05)", padding: "0.2rem 0.4rem", borderRadius: "4px", marginRight: "0.5rem" }}>
                        ID {m.id} - GRUPO {m.group_name}
                      </span>
                      <div className="admin-match-teams" style={{ marginTop: "0.25rem" }}>
                        {m.home_team} vs {m.away_team}
                      </div>
                    </div>
                    <div className="admin-score-inputs">
                      <input
                        type="number"
                        min="0"
                        placeholder="L"
                        className="score-input"
                        value={matchScoreChanges[m.id]?.home_actual}
                        onChange={(e) =>
                          setMatchScoreChanges({
                            ...matchScoreChanges,
                            [m.id]: { ...matchScoreChanges[m.id], home_actual: e.target.value }
                          })
                        }
                      />
                      <span style={{ color: "hsl(var(--text-muted))" }}>-</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="V"
                        className="score-input"
                        value={matchScoreChanges[m.id]?.away_actual}
                        onChange={(e) =>
                          setMatchScoreChanges({
                            ...matchScoreChanges,
                            [m.id]: { ...matchScoreChanges[m.id], away_actual: e.target.value }
                          })
                        }
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: "0.5rem", borderRadius: "6px" }}
                        onClick={() => handleUpdateMatchScore(m.id)}
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knockout Admin Tab */}
            {adminTab === "knockout" && (
              <div className="admin-match-list">
                <section className="knockout-panel admin-knockout-panel">
                  <div className="knockout-header">
                    <div>
                      <h3 className="table-title">Pronósticos de Participantes</h3>
                      <div className="deadline-row">
                        <CalendarClock size={16} />
                        <span>
                          Cierre: {knockoutDeadlineText || "20 jul 2026, 11:59 p. m."}
                        </span>
                      </div>
                    </div>
                    <span className={`lock-badge ${knockoutData?.locked ? "locked" : "open"}`}>
                      {knockoutData?.locked ? "Cerrado" : "Abierto"}
                    </span>
                  </div>

                  {knockoutData?.locked ? (
                    <div className="knockout-alert error">
                      El formulario ya está cerrado. Desde este momento solo se pueden cargar resultados.
                    </div>
                  ) : (
                    <div className="knockout-alert">
                      Selecciona el participante y guarda sus marcadores antes del primer partido.
                    </div>
                  )}

                  <div className="knockout-selector">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Participante</label>
                      <select
                        className="form-control"
                        value={selectedKnockoutParticipantId}
                        onChange={(e) => setSelectedKnockoutParticipantId(e.target.value)}
                        disabled={knockoutData?.locked}
                      >
                        <option value="">Selecciona un participante</option>
                        {leaderboard.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - {p.totalPoints} pts
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="current-points-box">
                      <span>Puntos actuales</span>
                      <strong>{knockoutSelectedParticipant?.totalPoints ?? "--"} pts</strong>
                    </div>
                  </div>

                  <div className="knockout-match-grid">
                    {knockoutData?.matches?.filter(m => m.stage === "Octavos").map((m) => (
                      <div key={m.id} className="knockout-match-card">
                        <div className="match-meta">
                          <span>{m.stage}</span>
                          <span>Partido {m.id}</span>
                        </div>
                        <div className="knockout-teams">
                          <span>{m.home_team}</span>
                          <span>vs</span>
                          <span>{m.away_team}</span>
                        </div>
                        <div className="knockout-score-row">
                          <input
                            type="number"
                            min="0"
                            className="score-input"
                            value={knockoutPredChanges[m.id]?.home_pred ?? ""}
                            disabled={!selectedKnockoutParticipantId || knockoutData?.locked}
                            onChange={(e) =>
                              setKnockoutPredChanges({
                                ...knockoutPredChanges,
                                [m.id]: {
                                  ...knockoutPredChanges[m.id],
                                  home_pred: e.target.value
                                }
                              })
                            }
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            className="score-input"
                            value={knockoutPredChanges[m.id]?.away_pred ?? ""}
                            disabled={!selectedKnockoutParticipantId || knockoutData?.locked}
                            onChange={(e) =>
                              setKnockoutPredChanges({
                                ...knockoutPredChanges,
                                [m.id]: {
                                  ...knockoutPredChanges[m.id],
                                  away_pred: e.target.value
                                }
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").length > 0 && (
                    <div className="past-matches-panel" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
                      <button
                        type="button"
                        className="past-matches-toggle"
                        onClick={() => setShowPastKnockoutPreds(!showPastKnockoutPreds)}
                        style={{ width: "100%" }}
                      >
                        <span>Fase Anterior (Dieciseisavos)</span>
                        <span>{showPastKnockoutPreds ? "Ocultar" : "Mostrar"} ({knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").length})</span>
                      </button>
                      {showPastKnockoutPreds && (
                        <div className="knockout-match-grid" style={{ marginTop: "1rem" }}>
                          {knockoutData?.matches?.filter(m => m.stage === "Dieciseisavos").map((m) => (
                            <div key={m.id} className="knockout-match-card">
                              <div className="match-meta">
                                <span>{m.stage}</span>
                                <span>Partido {m.id}</span>
                              </div>
                              <div className="knockout-teams">
                                <span>{m.home_team}</span>
                                <span>vs</span>
                                <span>{m.away_team}</span>
                              </div>
                              <div className="knockout-score-row">
                                <input
                                  type="number"
                                  min="0"
                                  className="score-input"
                                  value={knockoutPredChanges[m.id]?.home_pred ?? ""}
                                  disabled={!selectedKnockoutParticipantId || knockoutData?.locked}
                                  onChange={(e) =>
                                    setKnockoutPredChanges({
                                      ...knockoutPredChanges,
                                      [m.id]: {
                                        ...knockoutPredChanges[m.id],
                                        home_pred: e.target.value
                                      }
                                    })
                                  }
                                />
                                <span>-</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="score-input"
                                  value={knockoutPredChanges[m.id]?.away_pred ?? ""}
                                  disabled={!selectedKnockoutParticipantId || knockoutData?.locked}
                                  onChange={(e) =>
                                    setKnockoutPredChanges({
                                      ...knockoutPredChanges,
                                      [m.id]: {
                                        ...knockoutPredChanges[m.id],
                                        away_pred: e.target.value
                                      }
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="knockout-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveKnockoutPredictions}
                      disabled={savingKnockout || knockoutData?.locked || !selectedKnockoutParticipantId}
                    >
                      <Save size={18} />
                      {savingKnockout ? "Guardando..." : "Guardar Pronósticos"}
                    </button>
                  </div>
                </section>

                <div className="admin-info-row">
                  <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                    Esta pestaña es solo para cargar los pronósticos de cada participante. Los resultados reales se cargan en la pestaña Resultados Reales.
                  </p>
                  <span className={`lock-badge ${knockoutData?.locked ? "locked" : "open"}`}>
                    {knockoutSubmittedParticipants}/{knockoutData?.participants?.length || 0} enviados
                  </span>
                </div>
              </div>
            )}

            {/* Participants Admin Tab */}
            {adminTab === "participants" && (
              <table className="custom-table participants-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th style={{ textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p) => (
                    <tr key={p.id} style={{ cursor: "default" }}>
                      <td style={{ width: "80px" }}>#{p.id}</td>
                      <td>
                        <span style={{ fontWeight: "600" }}>{p.name}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingNameId(p.id);
                              setNewNameVal(p.name);
                            }}
                          >
                            <Edit2 size={12} />
                            <span className="hidden-mobile">Renombrar</span>
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleEditParticipantPreds(p.id)}
                          >
                            <FileText size={12} />
                            <span className="hidden-mobile">Editar Predicciones</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Settings Admin Tab */}
            {adminTab === "settings" && (
              <div style={{ maxWidth: "500px", margin: "1rem 0" }}>
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem", marginBottom: "2rem" }}>
                  Configura los puntos otorgados por cada tipo de predicción. Al guardar, el marcador se recalculará automáticamente.
                </p>
                
                <div className="form-group">
                  <label className="form-label">Marcador Exacto (Ej: Predices 2-1 y queda 2-1)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={editingSettings.exact}
                    onChange={(e) => setEditingSettings({ ...editingSettings, exact: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Acierto Ganador o Empate (Ej: Predices 2-1, queda 3-0 [gana local] o Predices 1-1, queda 2-2 [empate])</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={editingSettings.outcome}
                    onChange={(e) => setEditingSettings({ ...editingSettings, outcome: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fallo de Predicción (Ej: Predices que gana local, y gana visitante)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={editingSettings.fail}
                    onChange={(e) => setEditingSettings({ ...editingSettings, fail: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fecha Límite para Eliminatorias (Formato ISO, Ej: 2026-07-20T23:59:59-05:00)</label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DDTHH:MM:SS-05:00"
                    className="form-control"
                    value={editingSettings.knockoutDeadline || ""}
                    onChange={(e) => setEditingSettings({ ...editingSettings, knockoutDeadline: e.target.value })}
                  />
                </div>
                
                <button className="btn btn-primary" onClick={handleSaveSettings} style={{ marginTop: "1rem" }}>
                  <Save size={18} /> Guardar Reglas y Fecha Límite
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Password Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <button className="modal-close" onClick={() => setShowLoginModal(false)}>
              <X size={24} />
            </button>
            
            <form onSubmit={handleLoginSubmit} style={{ margin: "1rem 0 0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", textAlign: "center" }}>
                <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "rgba(0, 242, 148, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
                  <Lock size={24} />
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Modo Administrador</h3>
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
                  Ingresa la contraseña de administrador para realizar modificaciones.
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="form-control"
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  autoFocus
                />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}>
                Acceder
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Participant Details Modal */}
      {selectedParticipantId && participantDetail && (
        <div className="modal-overlay" onClick={() => setSelectedParticipantId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedParticipantId(null)}>
              <X size={24} />
            </button>

            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <User size={20} style={{ color: "hsl(var(--primary))" }} />
                <h2 style={{ fontSize: "1.6rem", fontWeight: "800" }}>Polla de {participantDetail.name}</h2>
              </div>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                Revisa el detalle de marcadores pronosticados contra los resultados reales.
              </p>
            </div>

            {/* Fase de Eliminatorias (Show by default) */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{
                fontSize: "1.15rem",
                fontWeight: "700",
                color: "hsl(var(--primary))",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <Trophy size={18} />
                Fase de Eliminatorias
              </h3>
              {participantDetail.knockoutPredictions && participantDetail.knockoutPredictions.length > 0 ? (
                <div>
                  {/* Active Octavos section */}
                  {participantDetail.knockoutPredictions.filter(m => m.stage === "Octavos").length > 0 && (
                    <div className="groups-container" style={{ marginBottom: "1.5rem" }}>
                      <div className="group-card" style={{ gridColumn: "1 / -1" }}>
                        <h3 className="group-title">Octavos de Final</h3>
                        <div>
                          {participantDetail.knockoutPredictions.filter(m => m.stage === "Octavos").map((m) => (
                            <div key={m.matchId} className="match-row">
                              <div className="team-names">
                                <div className="team-item">
                                  <span className={`team-name ${m.homeActual > m.awayActual ? "bold" : ""}`}>
                                    {m.homeTeam || "Por definir"}
                                  </span>
                                  {m.homeActual !== null && (
                                    <span className="score-actual">{m.homeActual}</span>
                                  )}
                                </div>
                                <div className="team-item">
                                  <span className={`team-name ${m.awayActual > m.homeActual ? "bold" : ""}`}>
                                    {m.awayTeam || "Por definir"}
                                  </span>
                                  {m.awayActual !== null && (
                                    <span className="score-actual">{m.awayActual}</span>
                                  )}
                                </div>
                              </div>
                              <div className="score-display">
                                <div className="pred-box">
                                  <span style={{ color: "hsl(var(--text-muted))", fontSize: "0.75rem" }}>PRON:</span>
                                  {m.homePred !== null && m.awayPred !== null ? (
                                    <span>{m.homePred} - {m.awayPred}</span>
                                  ) : (
                                    <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>S/P</span>
                                  )}
                                </div>
                                {m.homeActual !== null && m.awayActual !== null && (
                                  <span className={`points-badge pts-${m.points === pointsSettings.exact ? "3" : m.points === pointsSettings.outcome ? "1" : "0"}`}>
                                    {m.points} pt{m.points !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Dieciseisavos section */}
                  {participantDetail.knockoutPredictions.filter(m => m.stage === "Dieciseisavos").length > 0 && (
                    <div className="past-matches-panel" style={{ marginBottom: "1.5rem" }}>
                      <button
                        type="button"
                        className="past-matches-toggle"
                        onClick={() => setShowPastKnockoutDetail(!showPastKnockoutDetail)}
                        style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}
                      >
                        <span>Fase Anterior (Dieciseisavos)</span>
                        <span>{showPastKnockoutDetail ? "Ocultar" : "Mostrar"} ({participantDetail.knockoutPredictions.filter(m => m.stage === "Dieciseisavos").length})</span>
                      </button>
                      {showPastKnockoutDetail && (
                        <div className="groups-container" style={{ marginTop: "1rem" }}>
                          <div className="group-card" style={{ gridColumn: "1 / -1" }}>
                            <h3 className="group-title">Dieciseisavos de Final</h3>
                            <div>
                              {participantDetail.knockoutPredictions.filter(m => m.stage === "Dieciseisavos").map((m) => (
                                <div key={m.matchId} className="match-row">
                                  <div className="team-names">
                                    <div className="team-item">
                                      <span className={`team-name ${m.homeActual > m.awayActual ? "bold" : ""}`}>
                                        {m.homeTeam || "Por definir"}
                                      </span>
                                      {m.homeActual !== null && (
                                        <span className="score-actual">{m.homeActual}</span>
                                      )}
                                    </div>
                                    <div className="team-item">
                                      <span className={`team-name ${m.awayActual > m.homeActual ? "bold" : ""}`}>
                                        {m.awayTeam || "Por definir"}
                                      </span>
                                      {m.awayActual !== null && (
                                        <span className="score-actual">{m.awayActual}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="score-display">
                                    <div className="pred-box">
                                      <span style={{ color: "hsl(var(--text-muted))", fontSize: "0.75rem" }}>PRON:</span>
                                      {m.homePred !== null && m.awayPred !== null ? (
                                        <span>{m.homePred} - {m.awayPred}</span>
                                      ) : (
                                        <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>S/P</span>
                                      )}
                                    </div>
                                    {m.homeActual !== null && m.awayActual !== null && (
                                      <span className={`points-badge pts-${m.points === pointsSettings.exact ? "3" : m.points === pointsSettings.outcome ? "1" : "0"}`}>
                                        {m.points} pt{m.points !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem", textAlign: "center", padding: "1rem" }}>
                  No hay pronósticos de eliminatorias cargados para este participante.
                </p>
              )}
            </div>

            {/* Fase de Grupos (Collapsed by default) */}
            <div style={{ marginBottom: "1rem" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModalGroupStage(!showModalGroupStage)}
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)"
                }}
              >
                <span>Fase de Grupos (Partidos Anteriores)</span>
                <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                  {showModalGroupStage ? "Ocultar ▲" : "Mostrar ▼"}
                </span>
              </button>

              {showModalGroupStage && (
                <div style={{ marginTop: "1.5rem" }} className="groups-container">
                  {Object.entries(getGroups(participantDetail.predictions)).map(([groupName, groupMatches]) => (
                    <div key={groupName} className="group-card">
                      <h3 className="group-title">Grupo {groupName}</h3>
                      <div>
                        {groupMatches.map((m) => (
                          <div key={m.matchId} className="match-row">
                            <div className="team-names">
                              <div className="team-item">
                                <span className={`team-name ${m.homeActual > m.awayActual ? "bold" : ""}`}>
                                  {m.homeTeam}
                                </span>
                                {m.homeActual !== null && (
                                  <span className="score-actual">{m.homeActual}</span>
                                )}
                              </div>
                              <div className="team-item">
                                <span className={`team-name ${m.awayActual > m.homeActual ? "bold" : ""}`}>
                                  {m.awayTeam}
                                </span>
                                {m.awayActual !== null && (
                                  <span className="score-actual">{m.awayActual}</span>
                                )}
                              </div>
                            </div>
                            <div className="score-display">
                              <div className="pred-box">
                                <span style={{ color: "hsl(var(--text-muted))", fontSize: "0.75rem" }}>PRON:</span>
                                {m.homePred !== null && m.awayPred !== null ? (
                                  <span>{m.homePred} - {m.awayPred}</span>
                                ) : (
                                  <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>S/P</span>
                                )}
                              </div>
                              {m.homeActual !== null && m.awayActual !== null && (
                                <span className={`points-badge pts-${m.points === pointsSettings.exact ? "3" : m.points === pointsSettings.outcome ? "1" : "0"}`}>
                                  {m.points} pt{m.points !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Predictions Modal */}
      {editingParticipant && (
        <div className="modal-overlay" onClick={() => setEditingParticipant(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px" }}>
            <button className="modal-close" onClick={() => setEditingParticipant(null)}>
              <X size={24} />
            </button>

            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "800" }}>
                Editar Predicciones de {editingParticipant.name}
              </h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                Corrige o ingresa los goles pronosticados para cada partido.
              </p>
            </div>

            <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "0.5rem", marginBottom: "1.5rem" }}>
              {editingParticipant.predictions.map((p) => (
                <div
                  key={p.matchId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    backgroundColor: "rgba(255,255,255,0.01)",
                    borderRadius: "6px",
                    marginBottom: "0.5rem"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(255,255,255,0.05)", padding: "0.1rem 0.3rem", borderRadius: "3px", marginRight: "0.5rem" }}>
                      GRUPO {p.groupName}
                    </span>
                    <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                      {p.homeTeam} vs {p.awayTeam}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <input
                      type="number"
                      min="0"
                      className="score-input"
                      value={editPredChanges[p.matchId]?.home_pred}
                      onChange={(e) =>
                        setEditPredChanges({
                          ...editPredChanges,
                          [p.matchId]: { ...editPredChanges[p.matchId], home_pred: e.target.value }
                        })
                      }
                    />
                    <span style={{ color: "hsl(var(--text-muted))" }}>-</span>
                    <input
                      type="number"
                      min="0"
                      className="score-input"
                      value={editPredChanges[p.matchId]?.away_pred}
                      onChange={(e) =>
                        setEditPredChanges({
                          ...editPredChanges,
                          [p.matchId]: { ...editPredChanges[p.matchId], away_pred: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setEditingParticipant(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveParticipantPreds}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Participant Modal */}
      {editingNameId !== null && (
        <div className="modal-overlay" onClick={() => setEditingNameId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <button className="modal-close" onClick={() => setEditingNameId(null)}>
              <X size={24} />
            </button>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveParticipantName(editingNameId);
              }}
              style={{ margin: "1rem 0 0" }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", textAlign: "center" }}>
                <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "rgba(0, 242, 148, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
                  <User size={24} />
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Renombrar Participante</h3>
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
                  Ingresa el nuevo nombre para el participante.
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label">Nuevo Nombre</label>
                <input
                  type="text"
                  className="form-control"
                  value={newNameVal}
                  onChange={(e) => setNewNameVal(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingNameId(null)} style={{ flex: 1, justifyContent: "center" }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast"
            style={{
              borderLeftColor: t.type === "error" ? "#ff4d4d" : "hsl(var(--primary))"
            }}
          >
            {t.type === "error" ? (
              <AlertCircle size={20} style={{ color: "#ff4d4d" }} />
            ) : (
              <CheckCircle size={20} style={{ color: "hsl(var(--primary))" }} />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
