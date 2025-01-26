import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
let processes = [];

// Helper function to parse command string into command and args
const parseCommand = (commandString) => {
    const parts = commandString.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    return { command, args };
};

// Add this helper function at the top with other helpers
const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
};

// Modify the new process creation
app.post('/api/processes', (req, res) => {
    const { name, command } = req.body;
    if (!name || !command) {
        return res.status(400).json({ error: 'Name and command are required' });
    }

    const { command: cmd, args } = parseCommand(command);
    const newProcess = {
        id: generateId(),
        name,
        command,
        pid: null,
        uptime: 'Stopped',
        started: null,
        status: 'stopped',
        process: null
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
        // Stop the process
        if (process.process) {
            process.process.kill();
            process.process = null;
        }
        process.status = 'stopped';
        process.pid = null;
        process.uptime = 'Stopped';
        process.started = null;
    } else {
        // Start the process
        const { command: cmd, args } = parseCommand(process.command);
        const childProcess = spawn(cmd, args);

        process.process = childProcess;
        process.pid = childProcess.pid;
        process.status = 'running';
        process.started = new Date().toISOString();

        // Handle process exit
        childProcess.on('exit', (code) => {
            process.status = 'stopped';
            process.pid = null;
            process.uptime = 'Stopped';
            process.started = null;
            process.process = null;
        });

        // Handle process error
        childProcess.on('error', (err) => {
            console.error(`Process error: ${err.message}`);
            process.status = 'stopped';
            process.pid = null;
            process.uptime = 'Stopped';
            process.started = null;
            process.process = null;
        });
    }

    // Create a sanitized version of the process object
    const { process: childProcess, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Restart a process
app.put('/api/processes/:id/restart', (req, res) => {
    const processId = parseInt(req.params.id);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    // Kill existing process if running
    if (process.process) {
        process.process.kill();
    }

    // Start new process
    const { command: cmd, args } = parseCommand(process.command);
    const childProcess = spawn(cmd, args);

    process.process = childProcess;
    process.pid = childProcess.pid;
    process.status = 'running';
    process.started = new Date().toISOString();

    // Handle process exit
    childProcess.on('exit', (code) => {
        process.status = 'stopped';
        process.pid = null;
        process.uptime = 'Stopped';
        process.started = null;
        process.process = null;
    });

    // Handle process error
    childProcess.on('error', (err) => {
        console.error(`Process error: ${err.message}`);
        process.status = 'stopped';
        process.pid = null;
        process.uptime = 'Stopped';
        process.started = null;
        process.process = null;
    });

    // Create a sanitized version of the process object
    const { process: proc, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Delete a process
app.delete('/api/processes/:id', (req, res) => {
    const processId = parseInt(req.params.id);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    // Kill the process if it's running
    if (process.process) {
        process.process.kill();
    }

    processes = processes.filter((p) => p.id !== processId);
    res.status(204).send();
});

// Serve the frontend
// API Routes
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Get all processes
app.get('/api/processes', (req, res) => {
    const sanitizedProcesses = processes.map(({ process: proc, ...process }) => ({
        ...process,
        uptime: process.status === 'running' ? calculateUptime(process.started) : 'Stopped'
    }));
    res.json(sanitizedProcesses);
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

    const { process: proc, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
