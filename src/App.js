import './App.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#ddd',
        font: {
          size: 14,
        }
      }
    },
    title: {
      display: true,
      text: 'Lap Time Comparison (s)',
      color: '#00aaff',
      font: {
        size: 18,
      }
    },
  },
  scales: {
    y: {
      beginAtZero: false,
      ticks: {
        color: '#ddd'
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      }
    },
    x: {
      ticks: {
        color: '#ddd'
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      }
    }
  },
};

const labels = ['Monza', 'Silverstone', 'Spa', 'Monaco', 'Suzuka'];

export const data = {
  labels,
  datasets: [
    {
      label: 'Driver 1',
      data: [82.1, 88.5, 104.3, 71.2, 92.8],
      backgroundColor: 'rgba(0, 170, 255, 0.7)',
    },
    {
      label: 'Driver 2',
      data: [82.5, 88.2, 104.1, 71.5, 93.1],
      backgroundColor: 'rgba(255, 87, 34, 0.7)',
    },
  ],
};


function App() {
  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('Comparing drivers...');
  };

  return (
    <div className="container">
      <div className="left-panel">
        <h2 className="panel-title">Driver Controls</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="driver1">Driver 1</label>
            <select id="driver1" name="driver1" defaultValue="hamilton">
              <option value="hamilton">Lewis Hamilton</option>
              <option value="verstappen">Max Verstappen</option>
              <option value="norris">Lando Norris</option>
              <option value="leclerc">Charles Leclerc</option>
              <option value="russell">George Russell</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="driver2">Driver 2</label>
            <select id="driver2" name="driver2" defaultValue="verstappen">
              <option value="verstappen">Max Verstappen</option>
              <option value="hamilton">Lewis Hamilton</option>
              <option value="norris">Lando Norris</option>
              <option value="leclerc">Charles Leclerc</option>
              <option value="russell">George Russell</option>
            </select>
          </div>
          <button type="submit">Analyze</button>
        </form>
      </div>
      <div className="right-panel">
        <h2 className="panel-title">Analysis</h2>
        <div className="chat-message chart-container">
          <Bar options={options} data={data} />
        </div>
        <div className="chat-message">
          <p>More charts and data will appear here...</p>
        </div>
      </div>
    </div>
  );
}

export default App;
