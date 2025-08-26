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
  const [drivers, setDrivers] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState(["", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");
  const [standings, setStandings] = useState([]);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState([]);
  const [qualifying, setQualifying] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [driverCodeInputs, setDriverCodeInputs] = useState(["", ""]);
  const [comparisonMetric, setComparisonMetric] = useState("points");

  // Debounce year input ----------------------------------------------------
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedYear(year), 500);
    return () => clearTimeout(handler);
  }, [year]);

  // Fetch everything for the chosen season ---------------------------------
  useEffect(() => {
    const fetchDataForYear = async (season) => {
      setIsLoading(true);
      setApiError("");
      try {
        const [driversRes, standingsRes, resultsRes, qualiRes, scheduleRes] =
          await Promise.all([
            fetch(`/api/drivers/${season}`),
            fetch(`/api/standings/${season}`),
            fetch(`/api/results/${season}`),
            fetch(`/api/qualifying/${season}`),
            fetch(`/api/schedule/${season}`),
          ]);

        const throwIfBad = (res, label) => {
          if (!res.ok) throw new Error(`API error ${label}: ${res.status}`);
          return res.json();
        };

        const [d, s, r, q, sch] = await Promise.all([
          throwIfBad(driversRes, "drivers"),
          throwIfBad(standingsRes, "standings"),
          throwIfBad(resultsRes, "results"),
          throwIfBad(qualiRes, "qualifying"),
          throwIfBad(scheduleRes, "schedule"),
        ]);

        const driverList = d.drivers || [];
        setDrivers(driverList);
        setStandings(s.standings || []);
        setResults(r.races || []);
        setQualifying(q.races || []);
        setSchedule(sch.races || []);

        // Auto-select first two drivers if none chosen
        if (driverCodeInputs.every((c) => !c) && driverList.length >= 2) {
          const d1 = driverList[0].driverId;
          const d2 = driverList[1].driverId;
          setDriverCodeInputs([d1, d2]);
          setSelectedDrivers([d1, d2]);
        }
      } catch (err) {
        setApiError(err.message || "Failed to load season data.");
        setDrivers([]);
        setStandings([]);
        setResults([]);
        setQualifying([]);
        setSchedule([]);
      }
      setIsLoading(false);
    };

    if (debouncedYear && debouncedYear.length === 4)
      fetchDataForYear(debouncedYear);
  }, [debouncedYear]);

  // Driver lookup by ID ---------------------------------------------------
  const handleDriverCodeChange = (index, codeValue) => {
    const value = (codeValue || "").toLowerCase();
    const nextInputs = [...driverCodeInputs];
    nextInputs[index] = value;
    setDriverCodeInputs(nextInputs);

    const match = drivers.find(
      (d) => (d.driverId || "").toLowerCase() === value
    );
    const nextSelected = [...selectedDrivers];
    nextSelected[index] = match ? match.driverId : "";
    setSelectedDrivers(nextSelected);
  };

  // -------------------------------------------------------------------------
  // Chart data
  const getComparisonLineData = () => {
    if (!selectedDrivers[0] || !selectedDrivers[1] || !schedule.length)
      return { labels: [], datasets: [] };

    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };

    const labels = schedule.map((r) => r.raceName || `Round ${r.round}`);
    const dataA = [];
    const dataB = [];

    for (const race of schedule) {
      let resA, resB;

      if (comparisonMetric === "quali") {
        const qRace = qualifying.find((q) => q.round === race.round);
        resA = (qRace?.QualifyingResults || []).find(
          (r) => r.Driver?.driverId === selectedDrivers[0]
        );
        resB = (qRace?.QualifyingResults || []).find(
          (r) => r.Driver?.driverId === selectedDrivers[1]
        );
      } else {
        const rRace = results.find((r) => r.round === race.round);
        resA = (rRace?.Results || []).find(
          (r) => r.Driver?.driverId === selectedDrivers[0]
        );
        resB = (rRace?.Results || []).find(
          (r) => r.Driver?.driverId === selectedDrivers[1]
        );
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
        min: comparisonMetric !== "points" ? 1 : undefined,
        max: comparisonMetric !== "points" ? MAX_POSITION : undefined,
      },
    },
  };

  const smallChartOptions = {
    ...chartOptions,
    scales: { y: { beginAtZero: true } },
    plugins: { ...chartOptions.plugins, title: { display: false } },
  };

  const renderChart = () => (
    <Line options={chartOptions} data={getComparisonLineData()} />
  );

  const getStandingsPointsChart = () => {
    if (!standings.length) return null;
    const labels = standings.map(
      (s) => `${s.Driver.givenName} ${s.Driver.familyName}`
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
              },
            ],
          }}
          options={smallChartOptions}
        />
      </div>
    );
  };

  const getStandingsWinsChart = () => {
    if (!standings.length) return null;
    const labels = standings.map(
      (s) => `${s.Driver.givenName} ${s.Driver.familyName}`
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
              },
            ],
          }}
          options={smallChartOptions}
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
          <h3>{driver ? `${driver.givenName} ${driver.familyName}` : driverId}</h3>
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
          </form>
        </div>

        <div className="right-panel">
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === "comparison" ? "active" : ""}`}
              onClick={() => setActiveTab("comparison")}
            >
              Performance Comparison
            </button>
            <button
              className={`tab-button ${activeTab === "statistics" ? "active" : ""}`}
              onClick={() => setActiveTab("statistics")}
            >
              Driver Statistics
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "comparison" && (
              <>
                <div className="chart-container">
                  {isLoading ? (
                    <div className="loading-indicator">Loading…</div>
                  ) : (
                    renderChart()
                  )}
                </div>
                <div className="chart-grid">
                  {getStandingsPointsChart()}
                  {getStandingsWinsChart()}
                </div>
              </>
            )}

            {activeTab === "statistics" && (
              <div className="statistics-grid">
                {selectedDrivers.map((id) => getDriverStats(id))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;