import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5430;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files (frontend)
app.use(express.static(join(__dirname, 'public')));

// In-memory storage for processes
let processes = [
    {
        id: 1,
        name: 'Web Server',
        pid: 6918,
        uptime: '0s',
        started: new Date().toISOString(),
        command: 'python -m http.server 8000',
        status: 'running',
    },
];

// Helper function to simulate uptime
const startUptimeTimer = (process) => {
    if (process.status === 'running') {
        const startTime = new Date(process.started).getTime();
        process.intervalId = setInterval(() => {
            const now = new Date().getTime();
            const uptimeInSeconds = Math.floor((now - startTime) / 1000);
            const minutes = Math.floor(uptimeInSeconds / 60);
            const seconds = uptimeInSeconds % 60;
            process.uptime = `${minutes}m ${seconds}s`;
        }, 1000);
    }
};

// Start uptime timers for existing processes
processes.forEach((process) => {
    if (process.status === 'running') {
        startUptimeTimer(process);
    }
});

// Routes

// Helper function to calculate uptime
const calculateUptime = (startTime) => {
    if (!startTime) return '0s';
    const now = new Date().getTime();
    const uptimeInSeconds = Math.floor((now - new Date(startTime).getTime()) / 1000);
    const minutes = Math.floor(uptimeInSeconds / 60);
    const seconds = uptimeInSeconds % 60;
    return `${minutes}m ${seconds}s`;
};

// Get all processes
app.get('/api/processes', (req, res) => {
    const sanitizedProcesses = processes.map(({ intervalId, ...process }) => ({
        ...process,
        uptime: process.status === 'running' ? calculateUptime(process.started) : 'Stopped'
    }));
    res.json(sanitizedProcesses);
});

// Add a new process
app.post('/api/processes', (req, res) => {
    const { name, command } = req.body;
    if (!name || !command) {
        return res.status(400).json({ error: 'Name and command are required' });
    }

    const newProcess = {
        id: processes.length + 1,
        name,
        pid: Math.floor(Math.random() * 10000),
        uptime: 'Stopped',
        started: null,
        command,
        status: 'stopped',
    };

    processes.push(newProcess);
    res.status(201).json(newProcess);
});

// Toggle process status (start/stop)
app.put('/api/processes/:id/toggle', (req, res) => {
    const processId = parseInt(req.params.id);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (process.status === 'running') {
        process.status = 'stopped';
        clearInterval(process.intervalId);
        process.uptime = 'Stopped';
    } else {
        process.status = 'running';
        process.started = new Date().toISOString();
        startUptimeTimer(process);
    }

    // Create a sanitized version of the process object without intervalId
    const { intervalId, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Restart a process
app.put('/api/processes/:id/restart', (req, res) => {
    const processId = parseInt(req.params.id);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    process.started = new Date().toISOString();
    process.status = 'running';

    // Create a sanitized version of the process object without intervalId
    const { intervalId, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Edit a process
app.put('/api/processes/:id', (req, res) => {
    const processId = parseInt(req.params.id);
    const { name, command } = req.body;
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (name) process.name = name;
    if (command) process.command = command;

    res.json(process);
});

// Delete a process
app.delete('/api/processes/:id', (req, res) => {
    const processId = parseInt(req.params.id);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    clearInterval(process.intervalId);
    processes = processes.filter((p) => p.id !== processId);
    res.status(204).send();
});

// Serve the frontend
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
