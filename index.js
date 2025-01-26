import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import {
    generateId,
    saveProcessData,
    spawnProcess,
    killProcess,
    loadProcesses
} from './helpers.js';

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
const DATA_DIR = join(__dirname, 'data');

// Create data directory if it doesn't exist
await fs.mkdir(DATA_DIR, { recursive: true });

// Load existing processes
processes = await loadProcesses(DATA_DIR);

// Update process creation
app.post('/api/processes', async (req, res) => {
    const { name, command } = req.body;
    if (!name || !command) {
        return res.status(400).json({ error: 'Name and command are required' });
    }

    const id = generateId();
    const newProcess = {
        id,
        name,
        command,
        pid: null,
        started: null,
        status: 'stopped',
        process: null
    };

    await saveProcessData(id, newProcess, DATA_DIR);
    processes.push(newProcess);
    res.status(201).json(newProcess);
});

// Modify spawn process to use process directory
// Add near the top with other helper functions
const parseCommand = (commandString) => {
    const parts = commandString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    return {
        command: parts[0],
        args: parts.slice(1).map(arg => arg.replace(/^"(.*)"$/, '$1'))
    };
};

// Update the toggle endpoint's stop section
app.put('/api/processes/:id/toggle', async (req, res) => {
    const processId = req.params.id;
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (process.status === 'running') {
        // Stop the process
        if (process.process) {
            killProcess(process.process);
            process.process = null;
        }
        process.status = 'stopped';
        process.pid = null;
        process.started = null;
        await saveProcessData(process.id, process, DATA_DIR);
    } else {
        const childProcess = await spawnProcess(process, DATA_DIR);
        process.process = childProcess;
        process.pid = childProcess.pid;
        process.status = 'running';
        process.started = new Date().toISOString();

        // Handle process exit
        childProcess.on('exit', (code) => {
            process.status = 'stopped';
            process.pid = null;
            process.started = null;
            process.process = null;
        });

        // Handle process error
        childProcess.on('error', (err) => {
            console.error(`Process error: ${err.message}`);
            process.status = 'stopped';
            process.pid = null;
            process.started = null;
            process.process = null;
        });
    }

    await saveProcessData(process.id, process, DATA_DIR);
    const { process: childProcess, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Restart a process
app.put('/api/processes/:id/restart', async (req, res) => {
    const processId = req.params.id;
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    // Kill existing process if running
    if (process.process) {
        killProcess(process.process);
    }

    // Start new process using spawnProcess
    const childProcess = await spawnProcess(process);
    process.process = childProcess;
    process.pid = childProcess.pid;
    process.status = 'running';
    process.started = new Date().toISOString();

    // Handle process exit
    childProcess.on('exit', async (code) => {
        process.status = 'stopped';
        process.pid = null;
        process.started = null;
        process.process = null;
        await saveProcessData(process.id, process, DATA_DIR);
    });

    // Handle process error
    childProcess.on('error', async (err) => {
        console.error(`Process error: ${err.message}`);
        process.status = 'stopped';
        process.pid = null;
        process.started = null;
        process.process = null;
        await saveProcessData(process.id, process, DATA_DIR);
    });

    await saveProcessData(process.id, process, DATA_DIR);
    const { process: proc, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Delete a process
app.delete('/api/processes/:id', async (req, res) => {
    const processId = req.params.id;
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    // Kill the process if it's running
    if (process.process) {
        killProcess(process.process);
    }

    // Remove process directory
    try {
        await fs.rm(join(DATA_DIR, process.id), { recursive: true, force: true });
    } catch (err) {
        console.error('Error removing process directory:', err);
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
    }));
    res.json(sanitizedProcesses);
});

// Edit a process
app.put('/api/processes/:id', async (req, res) => {
    const processId = req.params.id;
    const { name, command } = req.body;
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (name) process.name = name;
    if (command) process.command = command;

    // Save changes to disk
    await saveProcessData(process.id, process, DATA_DIR);

    const { process: proc, ...sanitizedProcess } = process;
    res.json(sanitizedProcess);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
