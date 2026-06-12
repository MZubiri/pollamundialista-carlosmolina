import React, { useState, useEffect } from "react";
import {
  Trophy,
  Users,
  Settings,
  RefreshCw,
  X,
  Edit2,
  Save,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  User,
  Sliders
} from "lucide-react";

export default function App() {
  const [view, setView] = useState("leaderboard"); // leaderboard, admin
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [participantDetail, setParticipantDetail] = useState(null);
  const [matches, setMatches] = useState([]);
  
  // Admin states
  const [adminTab, setAdminTab] = useState("matches"); // matches, participants, settings
  const [syncing, setSyncing] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null); // { id, name, predictions }
  const [editPredChanges, setEditPredChanges] = useState({}); // { matchId: { homePred, awayPred } }
  const [matchScoreChanges, setMatchScoreChanges] = useState({}); // { matchId: { homeActual, awayActual } }
  const [editingNameId, setEditingNameId] = useState(null);
  const [newNameVal, setNewNameVal] = useState("");
  
  // Scoring rules settings state
  const [pointsSettings, setPointsSettings] = useState({ exact: 3, outcome: 1, fail: 0 });
  const [editingSettings, setEditingSettings] = useState({ exact: 3, outcome: 1, fail: 0 });
  
  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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

  useEffect(() => {
    fetchLeaderboard();
    fetchSettings();
  }, []);

  // Fetch Participant Detail when ID changes
  useEffect(() => {
    if (selectedParticipantId) {
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

  // Handle API sync
  const handleApiSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/matches/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      addToast(data.message || "Sync completed successfully!");
      fetchLeaderboard();
      if (view === "admin") {
        fetchMatches();
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  // Update Match Actual Score
  const handleUpdateMatchScore = async (matchId) => {
    const scores = matchScoreChanges[matchId];
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_actual: scores.home_actual === "" ? null : scores.home_actual,
          away_actual: scores.away_actual === "" ? null : scores.away_actual
        })
      });
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

  // Save Participant Predictions
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictions: updatedPredictions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save predictions");
      
      addToast("Predicciones guardadas con éxito.");
      setEditingParticipant(null);
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Edit Participant Name
  const handleSaveParticipantName = async (id) => {
    if (!newNameVal || newNameVal.trim() === "") return;
    try {
      const res = await fetch(`/api/participants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNameVal.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename participant");
      
      addToast("Participante renombrado con éxito.");
      setEditingNameId(null);
      fetchLeaderboard();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Save Points Settings
  const handleSaveSettings = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSettings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      
      addToast("Reglas de puntuación actualizadas.");
      setPointsSettings(editingSettings);
      fetchLeaderboard(); // Recalculates points instantly!
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

  // Filter leaderboard by search term
  const filteredLeaderboard = leaderboard.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const podium = leaderboard.slice(0, 3);
  const restOfList = filteredLeaderboard;

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
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setView("admin");
                  fetchMatches();
                  fetchSettings();
                }}
              >
                <Settings size={18} />
                Panel Admin
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApiSync}
                disabled={syncing}
              >
                <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Sincronizando..." : "Sincronizar Resultados"}
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                setView("leaderboard");
                fetchLeaderboard();
              }}
            >
              <Users size={18} />
              Ver Tabla General
            </button>
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
                  <div className="podium-rank rank-2">2</div>
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
                  <div className="podium-rank rank-1">1</div>
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
                  <div className="podium-rank rank-3">3</div>
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
                <table className="custom-table">
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
                    {restOfList.map((p, index) => (
                      <tr key={p.id} onClick={() => setSelectedParticipantId(p.id)}>
                        <td className="rank-col">#{index + 1}</td>
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
      {view === "admin" && (
        <div className="dashboard-grid">
          <div className="table-card" style={{ padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 className="table-title">Panel de Administración</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className={`btn ${adminTab === "matches" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAdminTab("matches")}
                >
                  Resultados Reales
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                    Introduce los marcadores finales de los partidos conforme vayan ocurriendo.
                  </p>
                  <button
                    className="btn btn-secondary"
                    onClick={handleApiSync}
                    disabled={syncing}
                  >
                    <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    Sincronizar vía API
                  </button>
                </div>
                {matches.map((m) => (
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
            )}

            {/* Participants Admin Tab */}
            {adminTab === "participants" && (
              <table className="custom-table">
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
                        {editingNameId === p.id ? (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                              type="text"
                              className="search-input"
                              value={newNameVal}
                              onChange={(e) => setNewNameVal(e.target.value)}
                            />
                            <button
                              className="btn btn-primary"
                              style={{ padding: "0.4rem 0.8rem" }}
                              onClick={() => handleSaveParticipantName(p.id)}
                            >
                              Guardar
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.4rem 0.8rem" }}
                              onClick={() => setEditingNameId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: "600" }}>{p.name}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                            onClick={() => {
                              setEditingNameId(p.id);
                              setNewNameVal(p.name);
                            }}
                          >
                            <Edit2 size={12} />
                            Renombrar
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                            onClick={() => handleEditParticipantPreds(p.id)}
                          >
                            <FileText size={12} />
                            Editar Predicciones
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
                
                <button className="btn btn-primary" onClick={handleSaveSettings} style={{ marginTop: "1rem" }}>
                  <Save size={18} /> Guardar Reglas de Puntuación
                </button>
              </div>
            )}
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

            <div className="groups-container">
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
