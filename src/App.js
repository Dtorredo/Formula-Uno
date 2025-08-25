import React, { useState, useEffect } from "react";
import "./App.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  ArcElement,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  ArcElement
);

// F1 points system for top 10 classification
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function App() {
  const [drivers, setDrivers] = useState([]); // from API
  const [selectedDrivers, setSelectedDrivers] = useState(["", ""]); // store driverId
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");
  const [standings, setStandings] = useState([]);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState([]); // current season results per race
  const [driverCodeInputs, setDriverCodeInputs] = useState(["", ""]);

  // Fetch current season standings from FastAPI backend
  useEffect(() => {
    const loadStandings = async () => {
      try {
        const res = await fetch("/api/standings/current");
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        setStandings(json.standings || []);
      } catch (err) {
        setApiError("Unable to load live standings. Using demo data.");
      }
    };
    loadStandings();
  }, []);

  // Fetch current season drivers
  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const res = await fetch("/api/drivers/current");
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        const list = json.drivers || [];
        setDrivers(list);
        if (list.length >= 2) {
          setSelectedDrivers([list[0].driverId, list[1].driverId]);
          setDriverCodeInputs([list[0].code || "", list[1].code || ""]);
        }
      } catch (err) {
        setApiError((prev) => prev || "Unable to load drivers.");
      }
    };
    loadDrivers();
  }, []);

  // Fetch current season race results
  useEffect(() => {
    const loadResults = async () => {
      try {
        const res = await fetch("/api/results/current");
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        setResults(json.races || []);
      } catch (err) {
        setApiError((prev) => prev || "Unable to load race results.");
      }
    };
    loadResults();
  }, []);

  // Build per-round points for a driver from results
  const buildDriverPointsByRound = (driverId) => {
    const rounds = [];
    const labels = [];
    results.forEach((race) => {
      const resForDriver = (race.Results || []).find(
        (r) => r.Driver && r.Driver.driverId === driverId
      );
      labels.push(race.raceName || `Round ${race.round}`);
      if (!resForDriver) {
        rounds.push(0);
        return;
      }
      const pos = Number(resForDriver.position); // 1-based
      rounds.push(pos >= 1 && pos <= 10 ? F1_POINTS[pos - 1] : 0);
    });
    return { labels, rounds };
  };

  const handleDriverCodeChange = (index, codeValue) => {
    const value = (codeValue || "").toUpperCase();
    const nextInputs = [...driverCodeInputs];
    nextInputs[index] = value;
    setDriverCodeInputs(nextInputs);

    const match = drivers.find((d) => (d.code || "").toUpperCase() === value);
    const nextSelected = [...selectedDrivers];
    nextSelected[index] = match ? match.driverId : "";
    setSelectedDrivers(nextSelected);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Build comparison chart (points per round) for two selected drivers
  const getComparisonLineData = () => {
    if (!results.length || !selectedDrivers[0] || !selectedDrivers[1]) {
      return { labels: [], datasets: [] };
    }
    const a = buildDriverPointsByRound(selectedDrivers[0]);
    const b = buildDriverPointsByRound(selectedDrivers[1]);
    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };
    return {
      labels: a.labels,
      datasets: [
        {
          label: nameFor(selectedDrivers[0]),
          data: a.rounds,
          borderColor: "#111827",
          backgroundColor: "#11182710",
          borderWidth: 2,
          tension: 0.35,
        },
        {
          label: nameFor(selectedDrivers[1]),
          data: b.rounds,
          borderColor: "#2563eb",
          backgroundColor: "#2563eb10",
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#111827",
          font: { size: 14 },
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: "Points per Round (Comparison)",
        color: "#111827",
        font: { size: 18, weight: "bold" },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { color: "#111827" },
        grid: { color: "rgba(17, 24, 39, 0.08)" },
      },
      x: {
        ticks: { color: "#111827" },
        grid: { color: "rgba(17, 24, 39, 0.08)" },
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
  };

  const renderChart = () => {
    return <Line options={chartOptions} data={getComparisonLineData()} />;
  };

  // Additional charts from live standings
  const getStandingsPointsChart = () => {
    if (!standings.length) return null;
    const top = standings.slice(0, 10);
    const labels = top.map(
      (s) => `${s.Driver.givenName} ${s.Driver.familyName}`
    );
    const data = top.map((s) => Number(s.points));
    return (
      <div className="chart-card">
        <h3>Points (Top 10)</h3>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Points",
                data,
                backgroundColor: "#11182720",
                borderColor: "#111827",
              },
            ],
          }}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { display: false } },
          }}
        />
      </div>
    );
  };

  const getStandingsWinsChart = () => {
    if (!standings.length) return null;
    const top = standings.slice(0, 10);
    const labels = top.map((s) => `${s.Driver.code || s.Driver.familyName}`);
    const data = top.map((s) => Number(s.wins));
    return (
      <div className="chart-card">
        <h3>Wins (Top 10)</h3>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Wins",
                data,
                backgroundColor: "#2563eb20",
                borderColor: "#2563eb",
              },
            ],
          }}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { display: false } },
          }}
        />
      </div>
    );
  };

  const getStandingsPodiumsChart = () => {
    if (!standings.length) return null;
    // Ergast standings do not include podiums per season directly; approximate via position points order
    const top = standings.slice(0, 10);
    const labels = top.map((s) => `${s.Driver.code || s.Driver.familyName}`);
    const data = top.map((s) => Number(s.wins));
    return (
      <div className="chart-card">
        <h3>Podiums Proxy (Wins)</h3>
        <Line
          data={{
            labels,
            datasets: [
              {
                label: "Podiums (proxy)",
                data,
                borderColor: "#10b981",
                backgroundColor: "#10b98120",
                tension: 0.35,
              },
            ],
          }}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { display: false } },
          }}
        />
      </div>
    );
  };

  const getDriverStats = (driverId) => {
    const driver = drivers.find((d) => d.driverId === driverId);
    const standing = standings.find((s) => s.Driver.driverId === driverId);
    return (
      <div key={driverId} className="driver-stats">
        <div className="driver-header">
          {driver?.permanentNumber && (
            <span className="driver-number">#{driver.permanentNumber}</span>
          )}
          <h3>
            {driver ? `${driver.givenName} ${driver.familyName}` : driverId}
          </h3>
          <p className="driver-team">
            {driver?.code || driver?.nationality || ""}
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">
              {standing ? standing.points : "-"}
            </span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{standing ? standing.wins : "-"}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {standing ? standing.position : "-"}
            </span>
            <span className="stat-label">Standing</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="glass-card">
          <h1>🏎️ Formula One Driver Analysis</h1>
          <p>
            Compare driver performance across different tracks and statistics
          </p>
          {apiError && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.8rem",
                color: "#b91c1c",
              }}
            >
              {apiError}
            </p>
          )}
        </div>
      </header>

      <div className="container">
        <div className="left-panel">
          <h2 className="panel-title">Driver Selection</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="driver1">Driver 1 Code (e.g., HAM)</label>
              <input
                id="driver1"
                type="text"
                placeholder="HAM"
                value={driverCodeInputs[0]}
                onChange={(e) => handleDriverCodeChange(0, e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="driver2">Driver 2 Code (e.g., VER)</label>
              <input
                id="driver2"
                type="text"
                placeholder="VER"
                value={driverCodeInputs[1]}
                onChange={(e) => handleDriverCodeChange(1, e.target.value)}
              />
            </div>

            {/* Chart type removed since we now use live comparison line chart */}

            <button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Analyze Drivers"}
            </button>
          </form>

          {/* Removed driver previews container for a cleaner floating layout */}
        </div>

        <div className="right-panel">
          <div className="tab-navigation">
            <button
              className={`tab-button ${
                activeTab === "comparison" ? "active" : ""
              }`}
              onClick={() => setActiveTab("comparison")}
            >
              Performance Comparison
            </button>
            <button
              className={`tab-button ${
                activeTab === "statistics" ? "active" : ""
              }`}
              onClick={() => setActiveTab("statistics")}
            >
              Driver Statistics
            </button>
            <button
              className={`tab-button ${
                activeTab === "insights" ? "active" : ""
              }`}
              onClick={() => setActiveTab("insights")}
            >
              AI Insights
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "comparison" && (
              <>
                <div className="chart-container">{renderChart()}</div>
                <div className="chart-grid">
                  {getStandingsPointsChart()}
                  {getStandingsWinsChart()}
                  {getStandingsPodiumsChart()}
                </div>
              </>
            )}

            {activeTab === "statistics" && (
              <div className="statistics-grid">
                {selectedDrivers.map((driverKey) => getDriverStats(driverKey))}
              </div>
            )}

            {activeTab === "insights" && (
              <div className="insights-container">
                {(() => {
                  const d1 = drivers.find(
                    (d) => d.driverId === selectedDrivers[0]
                  );
                  const d2 = drivers.find(
                    (d) => d.driverId === selectedDrivers[1]
                  );
                  const s1 = standings.find(
                    (s) => s.Driver.driverId === selectedDrivers[0]
                  );
                  const s2 = standings.find(
                    (s) => s.Driver.driverId === selectedDrivers[1]
                  );
                  const name1 = d1
                    ? `${d1.givenName} ${d1.familyName}`
                    : selectedDrivers[0] || "Driver 1";
                  const name2 = d2
                    ? `${d2.givenName} ${d2.familyName}`
                    : selectedDrivers[1] || "Driver 2";
                  return (
                    <>
                      <div className="insight-card">
                        <h3>🏆 Current Standings Snapshot</h3>
                        <p>
                          {name1}: position {s1?.position ?? "-"}, points{" "}
                          {s1?.points ?? "-"}, wins {s1?.wins ?? "-"}
                        </p>
                        <p>
                          {name2}: position {s2?.position ?? "-"}, points{" "}
                          {s2?.points ?? "-"}, wins {s2?.wins ?? "-"}
                        </p>
                      </div>
                      <div className="insight-card">
                        <h3>📊 Relative Performance</h3>
                        <p>
                          {name1} vs {name2}: points delta{" "}
                          {s1 && s2
                            ? Number(s1.points) - Number(s2.points)
                            : "-"}
                          .
                        </p>
                        <p>
                          Wins delta{" "}
                          {s1 && s2 ? Number(s1.wins) - Number(s2.wins) : "-"}.
                        </p>
                      </div>
                      <div className="insight-card">
                        <h3>🎯 Form Guide</h3>
                        <p>
                          Based on current season standings, {name1} is{" "}
                          {s1 && s2
                            ? Number(s1.position) < Number(s2.position)
                              ? "ahead of"
                              : Number(s1.position) > Number(s2.position)
                              ? "behind"
                              : "level with"
                            : "comparable to"}{" "}
                          {name2}.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
