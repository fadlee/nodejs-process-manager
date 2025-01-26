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

const DATA_DIR = join(__dirname, 'data');

// Create data directory if it doesn't exist
await fs.mkdir(DATA_DIR, { recursive: true });

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
        status: 'stopped'
    };

    await saveProcessData(id, newProcess, DATA_DIR);
    res.status(201).json(newProcess);
});

// Update the toggle endpoint's stop section
app.put('/api/processes/:id/toggle', async (req, res) => {
    const processId = req.params.id;
    const processes = await loadProcesses(DATA_DIR);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    console.log('Toggle process', process);

    if (process.status === 'running') {
        // Stop the process
        if (process.pid) {
            await killProcess(process.pid);
        }
        process.status = 'stopped';
        process.pid = null;
        process.started = null;
        await saveProcessData(process.id, process, DATA_DIR);
    } else {
        const childProcess = await spawnProcess(process, DATA_DIR);
        process.pid = childProcess.pid;
        process.status = 'running';
        process.started = new Date().toISOString();

        // Handle process exit
        childProcess.on('exit', (code) => {
            process.status = 'stopped';
            process.pid = null;
            process.started = null;
        });

        // Handle process error
        childProcess.on('error', (err) => {
            console.error(`Process error: ${err.message}`);
            process.status = 'stopped';
            process.pid = null;
            process.started = null;
        });
    }

    await saveProcessData(process.id, process, DATA_DIR);
    res.json(process);
});

// Delete a process
app.delete('/api/processes/:id', async (req, res) => {
    const processId = req.params.id;
    const processes = await loadProcesses(DATA_DIR);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    // Kill the process if it's running
    if (process.pid) {
        killProcess(process.pid);
    }

    // Remove process directory
    try {
        await fs.rm(join(DATA_DIR, process.id), { recursive: true, force: true });
    } catch (err) {
        console.error('Error removing process directory:', err);
    }

    res.status(204).send();
});

// Serve the frontend
// API Routes
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Get all processes
app.get('/api/processes', async (req, res) => {
    const processes = await loadProcesses(DATA_DIR);
    res.json(processes);
});

// Edit a process
app.put('/api/processes/:id', async (req, res) => {
    const processId = req.params.id;
    const { name, command } = req.body;
    const processes = await loadProcesses(DATA_DIR);
    const process = processes.find((p) => p.id === processId);

    if (!process) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (name) process.name = name;
    if (command) process.command = command;

    // Save changes to disk
    await saveProcessData(process.id, process, DATA_DIR);

    res.json(process);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
