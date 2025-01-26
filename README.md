# Node.js Process Manager

A web-based process manager built with Node.js that allows you to manage and monitor system processes through a clean and intuitive interface.

## Features

- Start, stop, and monitor processes through a web interface
- Real-time process status updates
- Process management with name and command configuration
- Clean and responsive UI built with Alpine.js and Tailwind CSS
- RESTful API for process control

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm package manager

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd process-manager
```

2. Install dependencies:
```bash
npm install
# or using pnpm
pnpm install
```

3. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:5430`

## Usage

### Web Interface

1. Open your browser and navigate to `http://localhost:5430`
2. Click "Add New Process" to create a new process
3. Fill in the process details:
   - Name: A friendly name for the process
   - Command: The command to execute
4. Use the control buttons to:
   - Start/Stop processes
   - Edit process configuration
   - Delete processes

### API Endpoints

#### Get All Processes
```
GET /api/processes
```

#### Create Process
```
POST /api/processes
Body: { "name": "process-name", "command": "command-to-run" }
```

#### Toggle Process (Start/Stop)
```
PUT /api/processes/:id/toggle
```

#### Edit Process
```
PUT /api/processes/:id
Body: { "name": "new-name", "command": "new-command" }
```

#### Delete Process
```
DELETE /api/processes/:id
```

## Project Structure

- `index.js` - Main server file with Express.js setup and API routes
- `helpers.js` - Utility functions for process management
- `public/` - Frontend files
  - `index.html` - Web interface built with Alpine.js and Tailwind CSS
- `data/` - Directory for storing process configurations and logs

## Features

- Process Management:
  - Create and configure processes with custom names and commands
  - Start and stop processes with real-time status updates
  - Edit existing process configurations
  - Delete processes and clean up associated resources

- Process Monitoring:
  - View process status (running/stopped)
  - Process ID (PID) tracking
  - Start time tracking

- User Interface:
  - Clean and responsive design with Tailwind CSS
  - Real-time updates using Alpine.js
  - Intuitive process control buttons
  - Process information display

## License

ISC License
