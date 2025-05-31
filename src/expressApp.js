import express from 'express';
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';

/**
 * @module expressApp
 * @description Sets up and manages the Express server for the application.
 * This server primarily provides a health check and instance status endpoint.
 */

const app = express();

/**
 * Generates a string message detailing the current state of the application instance.
 * This includes version, branch, host, memory usage, and uptime.
 * @private
 * @function getInstStateMsg
 * @returns {string} A formatted string containing the instance state.
 */
function getInstStateMsg() {
    const branch = config.branch || 'unknown_branch';
    const inst = config.inst || 'unknown_inst';
    const host = config.host || 'unknown_host';
    const totalInst = config.totalInst || 'N/A';
    const codeVer = config.codeVer || 'unknown_version';
    const instActiveUntil = config.instActiveUntil || 'N/A';
    const debugging = config.debugging || false; // Default to false if undefined

    const memoryUsage = Math.floor(process.memoryUsage().rss / (1024 * 1024));
    const uptimeHours = +(process.uptime() / 3600).toFixed(2);

    return `DailyAyaTelegram ${branch} instance ${inst}@${host} (of total ${totalInst}) is active in ${
        debugging ? 'debugging' : 'normal'
    } mode of version ${codeVer} until ${instActiveUntil}.\n
Memory Used: ${memoryUsage} MB\n
Uptime: ${uptimeHours} hours`;
}

app.get('/', (req, res) => {
    try {
        const message = getInstStateMsg();
        res.send(message);
    } catch (error) {
        // Log the error and send a generic error message to the client
        logger('Error in GET / route while generating instance state message:', error);
        res.status(500).send('Error generating instance status.');
    }
});

export function startExpressServer() {
    const port = config.port; // Already defaults to 3000 in config.js if not set
    try {
        app.listen(port, () => {
            // Use bootstrapLogger for this initial server start message as it's part of app setup
            bootstrapLogger(`Express server listening on port ${port}`);
        });
    } catch (error) {
        bootstrapLogger(`Failed to start Express server on port ${port}:`, error);
        // Depending on severity, might want to process.exit(1)
        throw error; // Re-throw for app.js to potentially handle
    }
}

// Exporting app might be useful for testing or if other modules need to interact with it directly
export default app;
