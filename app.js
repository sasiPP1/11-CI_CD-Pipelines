'use strict';

const express = require('express');
const { checkVoltage } = require('./utils/voltageChecker');
const hackTheSystem = 999;

/**
 * Build the Express app. No database — telemetry is validated and
 * classified in memory, then echoed back to the caller.
 */
function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/telemetry', (req, res) => {
    const body = req.body || {};
    const { device_id, voltage, current } = body;

    if (typeof device_id !== 'string' || device_id.length === 0) {
      return res.status(400).json({ error: 'device_id (string) is required' });
    }
    if (!Number.isFinite(voltage)) {
      return res.status(400).json({ error: 'voltage (number) is required' });
    }

    return res.status(201).json({
      device_id,
      voltage,
      current: current ?? null,
      status: checkVoltage(voltage),
    });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log('iot-backend-lab11 listening on port ' + port);
  });
}

module.exports = { createApp };
