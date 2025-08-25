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
const CURRENT_YEAR = new Date().getFullYear();
const MAX_POSITION = 20; // For chart scaling

// Comparison metric options
const COMPARISON_METRICS = {
  points: "Points",
  position: "Race Position",
  quali: "Qualifying Position",
};

function App() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [drivers, setDrivers] = useState([]); // from API
  const [selectedDrivers, setSelectedDrivers] = useState(["", ""]); // store driverId
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");
  const [standings, setStandings] = useState([]);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState([]); // season results per race
  const [qualifying, setQualifying] = useState([]); // season qualifying results
  const [driverCodeInputs, setDriverCodeInputs] = useState(["", ""]);
  const [comparisonMetric, setComparisonMetric] = useState("points");

  const fetchDataForYear = async (season) => {
    setIsLoading(true);
    setApiError("");
    try {
      const [driversRes, standingsRes, resultsRes, qualiRes] = await Promise.all([
        fetch(`/api/drivers/${season}`),
        fetch(`/api/standings/${season}`),
        fetch(`/api/results/${season}`),
        fetch(`/api/qualifying/${season}`),
      ]);

      if (!driversRes.ok) throw new Error(`API error (drivers): ${driversRes.status}`);
      const driversData = await driversRes.json();
      const driverList = driversData.drivers || [];
      setDrivers(driverList);

      if (!standingsRes.ok) throw new Error(`API error (standings): ${standingsRes.status}`);
      const standingsData = await standingsRes.json();
      setStandings(standingsData.standings || []);

      if (!resultsRes.ok) throw new Error(`API error (results): ${resultsRes.status}`);
      const resultsData = await resultsRes.json();
      setResults(resultsData.races || []);

      if (!qualiRes.ok) throw new Error(`API error (qualifying): ${qualiRes.status}`);
      const qualiData = await qualiRes.json();
      setQualifying(qualiData.races || []);

      if (driverList.length >= 2) {
        setSelectedDrivers([driverList[0].driverId, driverList[1].driverId]);
        setDriverCodeInputs([driverList[0].code || "", driverList[1].code || ""]);
      } else {
        setSelectedDrivers(["", ""]);
        setDriverCodeInputs(["", ""]);
      }
    } catch (err) {
      setApiError(err.message || "Failed to fetch data for the selected year.");
      setDrivers([]);
      setStandings([]);
      setResults([]);
      setQualifying([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDataForYear(year);
  }, [year]);

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
    fetchDataForYear(year);
  };

  const getComparisonLineData = () => {
    if (!selectedDrivers[0] || !selectedDrivers[1]) {
      return { labels: [], datasets: [] };
    }

    const nameFor = (id) => {
      const d = drivers.find((x) => x.driverId === id);
      return d ? `${d.givenName} ${d.familyName}` : id;
    };

    let labels = [];
    let dataA = [];
    let dataB = [];

    if (comparisonMetric === "points") {
      results.forEach((race) => {
        labels.push(race.raceName || `Round ${race.round}`);
        const resA = (race.Results || []).find(r => r.Driver?.driverId === selectedDrivers[0]);
        const posA = resA ? Number(resA.position) : 0;
        dataA.push(posA > 0 && posA <= 10 ? F1_POINTS[posA - 1] : 0);

        const resB = (race.Results || []).find(r => r.Driver?.driverId === selectedDrivers[1]);
        const posB = resB ? Number(resB.position) : 0;
        dataB.push(posB > 0 && posB <= 10 ? F1_POINTS[posB - 1] : 0);
      });
    } else if (comparisonMetric === "position") {
      results.forEach((race) => {
        labels.push(race.raceName || `Round ${race.round}`);
        const resA = (race.Results || []).find(r => r.Driver?.driverId === selectedDrivers[0]);
        dataA.push(resA ? Number(resA.position) : null);

        const resB = (race.Results || []).find(r => r.Driver?.driverId === selectedDrivers[1]);
        dataB.push(resB ? Number(resB.position) : null);
      });
    } else if (comparisonMetric === "quali") {
      qualifying.forEach((race) => {
        labels.push(race.raceName || `Round ${race.round}`);
        const resA = (race.QualifyingResults || []).find(r => r.Driver?.driverId === selectedDrivers[0]);
        dataA.push(resA ? Number(resA.position) : null);

        const resB = (race.QualifyingResults || []).find(r => r.Driver?.driverId === selectedDrivers[1]);
        dataB.push(resB ? Number(resB.position) : null);
      });
    }

    return {
      labels,
      datasets: [
        { label: nameFor(selectedDrivers[0]), data: dataA, borderColor: "#111827", backgroundColor: "#11182710", tension: 0.1, spanGaps: true },
        { label: nameFor(selectedDrivers[1]), data: dataB, borderColor: "#2563eb", backgroundColor: "#2563eb10", tension: 0.1, spanGaps: true },
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
        text: `Driver Comparison: ${COMPARISON_METRICS[comparisonMetric]} (${year})`,
        font: { size: 18, weight: "bold" },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: comparisonMetric === 'points',
        reverse: comparisonMetric === 'position' || comparisonMetric === 'quali',
        min: comparisonMetric !== 'points' ? 1 : undefined,
        max: comparisonMetric !== 'points' ? MAX_POSITION : undefined,
      },
    },
  };

  const renderChart = () => {
    return <Line options={chartOptions} data={getComparisonLineData()} />;
  };

  const getStandingsPointsChart = () => {
    if (!standings.length) return null;
    const top = standings.slice(0, 10);
    const labels = top.map((s) => `${s.Driver.givenName} ${s.Driver.familyName}`);
    const data = top.map((s) => Number(s.points));
    return (
      <div className="chart-card">
        <h3>Points (Top 10) - {year}</h3>
        <Bar data={{ labels, datasets: [{ label: "Points", data, backgroundColor: "#11182720", borderColor: "#111827" }] }} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: false } } }} />
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
        <h3>Wins (Top 10) - {year}</h3>
        <Bar data={{ labels, datasets: [{ label: "Wins", data, backgroundColor: "#2563eb20", borderColor: "#2563eb" }] }} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: false } } }} />
      </div>
    );
  };

  const getStandingsPodiumsChart = () => {
    if (!standings.length) return null;
    const top = standings.slice(0, 10);
    const labels = top.map((s) => `${s.Driver.code || s.Driver.familyName}`);
    // Ergast API does not provide podiums count directly in standings. We can calculate it from results.
    const podiums = top.map(s => {
      return results.reduce((count, race) => {
        const res = (race.Results || []).find(r => r.Driver?.driverId === s.Driver.driverId);
        if (res && Number(res.position) <= 3) {
          return count + 1;
        }
        return count;
      }, 0);
    });
    return (
      <div className="chart-card">
        <h3>Podiums (Top 10) - {year}</h3>
        <Bar data={{ labels, datasets: [{ label: "Podiums", data: podiums, backgroundColor: "#10b98120", borderColor: "#10b981" }] }} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: false } } }} />
      </div>
    );
  };

  const getDriverStats = (driverId) => {
    const driver = drivers.find((d) => d.driverId === driverId);
    const standing = standings.find((s) => s.Driver.driverId === driverId);
    return (
      <div key={driverId} className="driver-stats">
        <div className="driver-header">
          {driver?.permanentNumber && <span className="driver-number">#{driver.permanentNumber}</span>}
          <h3>{driver ? `${driver.givenName} ${driver.familyName}` : driverId}</h3>
          <p className="driver-team">{driver?.code || driver?.nationality || ""}</p>
        </div>
        <div className="stats-grid">
          <div className="stat-item"><span className="stat-value">{standing ? standing.points : "-"}</span><span className="stat-label">Points</span></div>
          <div className="stat-item"><span className="stat-value">{standing ? standing.wins : "-"}</span><span className="stat-label">Wins</span></div>
          <div className="stat-item"><span className="stat-value">{standing ? standing.position : "-"}</span><span className="stat-label">Standing</span></div>
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="glass-card">
          <h1>🏎️ Formula One Driver Analysis</h1>
          <p>Compare driver performance across different tracks and statistics</p>
          {apiError && <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#b91c1c" }}>{apiError}</p>}
        </div>
      </header>

      <div className="container">
        <div className="left-panel">
          <h2 className="panel-title">Driver Selection</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="driver1">Driver 1 Code (e.g., HAM)</label>
              <input id="driver1" type="text" placeholder="HAM" value={driverCodeInputs[0]} onChange={(e) => handleDriverCodeChange(0, e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="driver2">Driver 2 Code (e.g., VER)</label>
              <input id="driver2" type="text" placeholder="VER" value={driverCodeInputs[1]} onChange={(e) => handleDriverCodeChange(1, e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="year">Year</label>
              <input id="year" type="number" placeholder="YYYY" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Comparison based on?</label>
              <div className="radio-group">
                {Object.entries(COMPARISON_METRICS).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="radio"
                      name="comparisonMetric"
                      value={key}
                      checked={comparisonMetric === key}
                      onChange={(e) => setComparisonMetric(e.target.value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Analyze Drivers"}
            </button>
          </form>
        </div>

        <div className="right-panel">
          <div className="tab-navigation">
            <button className={`tab-button ${activeTab === "comparison" ? "active" : ""}`} onClick={() => setActiveTab("comparison")}>Performance Comparison</button>
            <button className={`tab-button ${activeTab === "statistics" ? "active" : ""}`} onClick={() => setActiveTab("statistics")}>Driver Statistics</button>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
