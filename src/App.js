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

// Configurable API base: set REACT_APP_API_BASE in production
const API_BASE = process.env.REACT_APP_API_BASE || "";

async function fetchJson(path, label) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${label}: ${res.status} ${text.slice(0, 120)}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${label} did not return JSON: ${text.slice(0, 120)}`);
  }
  return res.json();
}

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

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const CURRENT_YEAR = new Date().getFullYear();
const MAX_POSITION = 20;

const COMPARISON_METRICS = {
  points: "Points",
  position: "Race Position",
  quali: "Qualifying Position",
};

function App() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [debouncedYear, setDebouncedYear] = useState(year);
  const [selectedDrivers, setSelectedDrivers] = useState(["", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");
  const [apiError, setApiError] = useState("");
  const [driverCodeInputs, setDriverCodeInputs] = useState(["", ""]);
  const [comparisonMetric, setComparisonMetric] = useState("points");
  
  // Consolidated state for all season data to prevent race conditions
  const [seasonData, setSeasonData] = useState(null);

  // Debounce year input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedYear(year), 500);
    return () => clearTimeout(handler);
  }, [year]);

  // When year changes, clear previously analyzed season
  useEffect(() => {
    setSeasonData(null);
  }, [debouncedYear]);

  // Fetch everything for the chosen season
  const fetchDataForYear = async (season) => {
    setIsLoading(true);
    setApiError("");
    setSeasonData(null); // Clear old data before fetching
    try {
      const [d, s, r, q, sch] = await Promise.all([
        fetchJson(`/api/drivers/${season}`, "drivers"),
        fetchJson(`/api/standings/${season}`, "standings"),
        fetchJson(`/api/results/${season}`, "results"),
        fetchJson(`/api/qualifying/${season}`, "qualifying"),
        fetchJson(`/api/schedule/${season}`, "schedule"),
      ]);

      setSeasonData({
        drivers: d.drivers || [],
        standings: s.standings || [],
        results: r.races || [],
        qualifying: q.races || [],
        schedule: sch.races || [],
      });
    } catch (err) {
      setApiError(err.message || "Failed to load season data.");
      setSeasonData(null);
    }
    setIsLoading(false);
  };

  // Auto-select first two drivers if none chosen
  useEffect(() => {
    if (seasonData && driverCodeInputs.every((c) => !c) && seasonData.drivers.length >= 2) {
      const d1 = seasonData.drivers[0].driverId;
      const d2 = seasonData.drivers[1].driverId;
      setDriverCodeInputs([d1, d2]);
      setSelectedDrivers([d1, d2]);
    }
  }, [seasonData, driverCodeInputs]);

  // Driver lookup by ID
  const handleDriverCodeChange = (index, codeValue) => {
    const raw = codeValue || "";
    const value = raw.trim().toLowerCase();
    const nextInputs = [...driverCodeInputs];
    nextInputs[index] = raw;
    setDriverCodeInputs(nextInputs);

    if (!seasonData) return;
    const norm = (s) => (s || "").toLowerCase();
    const match = seasonData.drivers.find(
      (d) => norm(d.driverId) === value || norm(d.driverCode) === value
    );
    const nextSelected = [...selectedDrivers];
    nextSelected[index] = match ? match.driverId : "";
    setSelectedDrivers(nextSelected);
  };
  
  // Chart data and options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20, bottom: 20, left: 10, right: 10 } },
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: `${COMPARISON_METRICS[comparisonMetric]} – ${year}`,
        font: { size: 18, weight: "bold" },
      },
    },
    scales: {
      y: {
        beginAtZero: comparisonMetric === "points",
        reverse: comparisonMetric !== "points",
        min: comparisonMetric !== "points" ? 1 : 0,
        max: comparisonMetric === "points" ? 26 : MAX_POSITION,
        grace: '10%', // Adds padding to top/bottom of chart
      },
    },
  };

  const smallChartOptions = {
    ...chartOptions,
    scales: { y: { beginAtZero: true, grace: '10%' } },
    plugins: { ...chartOptions.plugins, title: { display: false } },
  };

  const getComparisonLineData = () => {
    if (!seasonData || !selectedDrivers[0] || !selectedDrivers[1])
      return { labels: [], datasets: [] };

    const { schedule, drivers, qualifying, results } = seasonData;

    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };

    const labels = schedule.map((r) => r.raceName || `Round ${r.round}`);
    const dataA = [];
    const dataB = [];

    for (const race of schedule) {
      const round = Number(race.round);
      let resA, resB;

      if (comparisonMetric === "quali") {
        const qRound = qualifying.filter((q) => Number(q.round) === round);
        resA = qRound.find((r) => r.driverId === selectedDrivers[0]);
        resB = qRound.find((r) => r.driverId === selectedDrivers[1]);
      } else {
        const rRound = results.filter((r) => Number(r.round) === round);
        resA = rRound.find((r) => r.driverId === selectedDrivers[0]);
        resB = rRound.find((r) => r.driverId === selectedDrivers[1]);
      }

      if (comparisonMetric === "points") {
        const posA = resA ? Number(resA.position) : 0;
        dataA.push(posA >= 1 && posA <= 10 ? F1_POINTS[posA - 1] : 0);
        const posB = resB ? Number(resB.position) : 0;
        dataB.push(posB >= 1 && posB <= 10 ? F1_POINTS[posB - 1] : 0);
      } else {
        dataA.push(resA ? Number(resA.position) : null);
        dataB.push(resB ? Number(resB.position) : null);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: nameFor(selectedDrivers[0]),
          data: dataA,
          borderColor: "#111827",
          backgroundColor: "#11182710",
          tension: 0.1,
          spanGaps: true,
        },
        {
          label: nameFor(selectedDrivers[1]),
          data: dataB,
          borderColor: "#2563eb",
          backgroundColor: "#2563eb10",
          tension: 0.1,
          spanGaps: true,
        },
      ],
    };
  };

  const renderChart = () => (
    <Line options={chartOptions} data={getComparisonLineData()} />
  );

  const getOverallPointsLineData = () => {
    if (!seasonData || !selectedDrivers[0] || !selectedDrivers[1])
      return { labels: [], datasets: [] };
    
    const { schedule, results, drivers } = seasonData;

    const labels = schedule.map((r) => r.raceName || `Round ${r.round}`);
    const cumA = [];
    const cumB = [];
    let totalA = 0;
    let totalB = 0;
    for (const race of schedule) {
      const round = Number(race.round);
      const rRound = results.filter((r) => Number(r.round) === round);
      const ra = rRound.find((r) => r.driverId === selectedDrivers[0]);
      const rb = rRound.find((r) => r.driverId === selectedDrivers[1]);
      const posA = ra ? Number(ra.position) : 0;
      const posB = rb ? Number(rb.position) : 0;
      totalA += posA >= 1 && posA <= 10 ? F1_POINTS[posA - 1] : 0;
      totalB += posB >= 1 && posB <= 10 ? F1_POINTS[posB - 1] : 0;
      cumA.push(totalA);
      cumB.push(totalB);
    }
    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };
    return {
      labels,
      datasets: [
        {
          label: `${nameFor(selectedDrivers[0])} – Overall Points`,
          data: cumA,
          borderColor: "#0ea5e9",
          backgroundColor: "#0ea5e910",
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: `${nameFor(selectedDrivers[1])} – Overall Points`,
          data: cumB,
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b10",
          tension: 0.2,
          spanGaps: true,
        },
      ],
    };
  };

  const getPodiumsBarChart = () => {
    if (!seasonData) return null;
    const { schedule, results, drivers } = seasonData;

    const podiumCounts = new Map();
    for (const race of schedule) {
      const round = Number(race.round);
      const rRound = results.filter((r) => Number(r.round) === round);
      for (const res of rRound) {
        const pos = Number(res.position);
        if (pos >= 1 && pos <= 3) {
          const id = res.driverId;
          podiumCounts.set(id, (podiumCounts.get(id) || 0) + 1);
        }
      }
    }
    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };
    const sorted = Array.from(podiumCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const labels = sorted.map(([id]) => nameFor(id));
    const data = sorted.map(([, count]) => count);
    return (
      <div className="chart-card">
        <h3>Podiums – {year}</h3>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Podiums",
                data,
                backgroundColor: "#10b98120",
                borderColor: "#10b981",
                barPercentage: 0.7,
              },
            ],
          }}
          options={{
            ...smallChartOptions,
            indexAxis: "y",
            scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' } },
          }}
        />
      </div>
    );
  };

  const getStandingsPointsChart = () => {
    if (!seasonData) return null;
    const { standings } = seasonData;
    const labels = standings.map((s) =>
      `${s.givenName || ""} ${s.familyName || ""}`.trim()
    );
    const data = standings.map((s) => Number(s.points));
    return (
      <div className="chart-card">
        <h3>Points – {year}</h3>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Points",
                data,
                backgroundColor: "#11182720",
                borderColor: "#111827",
                barPercentage: 0.7,
              },
            ],
          }}
          options={smallChartOptions}
        />
      </div>
    );
  };

  const getStandingsWinsChart = () => {
    if (!seasonData) return null;
    const { standings } = seasonData;
    const labels = standings.map((s) =>
      `${s.givenName || ""} ${s.familyName || ""}`.trim()
    );
    const data = standings.map((s) => Number(s.wins));
    return (
      <div className="chart-card">
        <h3>Wins – {year}</h3>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Wins",
                data,
                backgroundColor: "#2563eb20",
                borderColor: "#2563eb",
                barPercentage: 0.7,
              },
            ],
          }}
          options={smallChartOptions}
        />
      </div>
    );
  };

  const getDriverStats = (driverId) => {
    if (!seasonData) return null;
    const { drivers, standings } = seasonData;
    const driver = drivers.find((d) => d.driverId === driverId);
    const standing = standings.find((s) => s.driverId === driverId);
    return (
      <div key={driverId} className="driver-stats">
        <div className="driver-header">
          {driver?.permanentNumber && (
            <span className="driver-number">#{driver.permanentNumber}</span>
          )}
          <h3>
            {driver ? `${driver.givenName} ${driver.familyName}` : driverId}
          </h3>
          <p className="driver-team">{driver?.nationality}</p>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{standing?.points ?? "-"}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{standing?.wins ?? "-"}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{standing?.position ?? "-"}</span>
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
          <p>Compare drivers across the entire season</p>
          {apiError && (
            <p style={{ color: "#b91c1c", fontSize: "0.8rem" }}>{apiError}</p>
          )}
        </div>
      </header>

      <div className="container">
        <div className="left-panel">
          <h2 className="panel-title">Driver Selection</h2>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label>Driver 1 ID</label>
              <input
                type="text"
                placeholder="hamilton"
                value={driverCodeInputs[0]}
                onChange={(e) => handleDriverCodeChange(0, e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Driver 2 ID</label>
              <input
                type="text"
                placeholder="verstappen"
                value={driverCodeInputs[1]}
                onChange={(e) => handleDriverCodeChange(1, e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input
                type="number"
                placeholder="YYYY"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Metric</label>
              <select
                value={comparisonMetric}
                onChange={(e) => setComparisonMetric(e.target.value)}
              >
                {Object.entries(COMPARISON_METRICS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <button
                type="button"
                onClick={() =>
                  debouncedYear &&
                  debouncedYear.length === 4 &&
                  fetchDataForYear(debouncedYear)
                }
                disabled={
                  !debouncedYear || debouncedYear.length !== 4 || isLoading
                }
              >
                {isLoading ? "Analyzing…" : "Analyze Season"}
              </button>
            </div>
          </form>
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
          </div>

          <div className="tab-content">
            {activeTab === "comparison" && (
              <>
                <div className="chart-container">
                  {isLoading && <div className="loading-indicator">Loading…</div>}
                  {!isLoading && !seasonData && <div className="loading-indicator">Select a year and click Analyze.</div>}
                  {!isLoading && seasonData && renderChart()}
                </div>
                <div className="chart-grid">
                  {seasonData && getStandingsPointsChart()}
                  {seasonData && getStandingsWinsChart()}
                  {seasonData && getPodiumsBarChart()}
                </div>
                <div
                  className="chart-container small"
                  style={{ marginTop: 16 }}
                >
                  {seasonData && (
                    <Line
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `Overall Points – ${year}`,
                          },
                        },
                        scales: { y: { beginAtZero: true, grace: '10%' } },
                      }}
                      data={getOverallPointsLineData()}
                    />
                  )}
                </div>
              </>
            )}

            {activeTab === "statistics" && (
              <div className="statistics-grid">
                {selectedDrivers.map((id) => id && getDriverStats(id))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;