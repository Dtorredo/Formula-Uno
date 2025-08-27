# Formula Uno - Driver Performance Analysis

This web application provides a platform to analyze and visualize Formula 1 driver performance data across different seasons. You can compare two drivers based on various metrics, view season standings, and explore race results.

## Features

*   **Driver Comparison:** Select two drivers and a season to compare their performance in terms of points, race positions, and qualifying results.
*   **Data Visualization:** View interactive charts that display the chosen comparison metric over the course of the season.
*   **Season Statistics:** See overall driver standings, including points, wins, and podium finishes for the selected season.
*   **Responsive Design:** The application is designed to work on different screen sizes.

## Tech Stack

*   **Frontend:**
    *   React
    *   Chart.js for data visualization
*   **Backend:**
    *   Python
    *   FastAPI for the REST API
    *   FastF1 library for fetching Formula 1 data

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   Node.js and npm (or yarn)
*   Python 3.x and pip

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/formula-uno.git
    cd formula-uno
    ```

2.  **Install frontend dependencies:**
    ```sh
    npm install
    ```

3.  **Install backend dependencies:**
    ```sh
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

### Running the Application

1.  **Start the backend server:**
    Open a terminal and run the following command. The API will be available at `http://localhost:8001`.
    ```sh
    npm run api
    ```

2.  **Start the frontend development server:**
    Open another terminal and run the following command. The application will be available at `http://localhost:3000`.
    ```sh
    npm start
    ```

## API Endpoints

The backend exposes the following endpoints:

*   `GET /api/schedule/{season}`: Get the race schedule for a given season.
*   `GET /api/drivers/{season}`: Get the list of drivers for a given season.
*   `GET /api/standings/{season}`: Get the driver standings for a given season.
*   `GET /api/results/{season}`: Get the race results for a given season.
*   `GET /api/qualifying/{season}`: Get the qualifying results for a given season.
*   `GET /api/status`: Check the status of the API.
*   `GET /api/session/{season}/{event}/{kind}`: Get information about a specific session.

## Project Structure

```
/
├── public/           # Public assets for the React app
├── server/           # FastAPI backend
│   └── main.py       # API endpoint definitions
├── src/              # React application source code
│   ├── App.js        # Main application component
│   └── ...
├── .fastf1-cache/    # Cache for FastF1 data
├── package.json      # Frontend dependencies and scripts
└── requirements.txt  # Backend Python dependencies
```