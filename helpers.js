import { spawn } from 'child_process';
import { join } from 'path';
import fs from 'fs/promises';

export const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
};

export const ensureProcessDir = async (processId, dataDir) => {
    const processDir = join(dataDir, processId);
    await fs.mkdir(processDir, { recursive: true });
    return processDir;
};

export const saveProcessData = async (processId, data, dataDir) => {
    const processDir = await ensureProcessDir(processId, dataDir);
    const sanitizedData = { ...data };
    delete sanitizedData.process;
    await fs.writeFile(
        join(processDir, 'process.json'),
        JSON.stringify(sanitizedData, null, 2)
    );
};

export const parseCommand = (commandString) => {
    const parts = commandString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    return {
        command: parts[0],
        args: parts.slice(1).map(arg => arg.replace(/^"(.*)"$/, '$1'))
    };
};

export const spawnProcess = async (process, dataDir) => {
    const processDir = await ensureProcessDir(process.id, dataDir);
    const { command, args } = parseCommand(process.command);

    const childProcess = spawn(command, args, {
        cwd: processDir,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    const stdout = await fs.open(join(processDir, 'stdout.log'), 'a');
    const stderr = await fs.open(join(processDir, 'stderr.log'), 'a');

    childProcess.stdout.pipe(stdout.createWriteStream());
    childProcess.stderr.pipe(stderr.createWriteStream());

    childProcess.on('exit', async () => {
        await stdout.close();
        await stderr.close();
    });

    return childProcess;
};

export const killProcess = (childProcess) => {
    console.log('Killing process:', childProcess.pid);
    try {
        // First try to kill the process directly
        childProcess.kill('SIGKILL');
    } catch (err) {
        console.error('Error killing process directly:', err);
        try {
            // Fallback to killing process group
            process.kill(childProcess.pid, 'SIGKILL');
        } catch (err) {
            console.error('Error killing process group:', err);
        }
    }
};

export const loadProcesses = async (dataDir) => {
    const processes = [];
    try {
        const dirs = await fs.readdir(dataDir);
        for (const dir of dirs) {
            try {
                const processPath = join(dataDir, dir, 'process.json');
                const data = JSON.parse(await fs.readFile(processPath, 'utf8'));
                
                // Check if process was running and verify its status
                if (data.status === 'running' && data.pid) {
                    try {
                        process.kill(data.pid, 0); // Check if process exists
                    } catch (e) {
                        // Process is no longer running
                        data.status = 'stopped';
                        data.pid = null;
                        data.started = null;
                        await saveProcessData(dir, data, dataDir);
                    }
                }
                
                processes.push({ ...data, process: null });
            } catch (err) {
                console.error(`Error loading process ${dir}:`, err);
            }
        }
    } catch (err) {
        console.error('Error loading processes:', err);
    }
    return processes;
};
