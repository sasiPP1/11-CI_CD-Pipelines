'use strict';

const request = require('supertest');
const { createApp } = require('./app');

describe('IoT Backend API', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    test('responds 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/telemetry', () => {
    test('responds 201 with CRITICAL status for voltage 260', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ device_id: 'esp32-01', voltage: 260 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('NORMAL_BUT_BROKEN');
      expect(res.body.device_id).toBe('esp32-01');
      expect(res.body.voltage).toBe(260);
      expect(res.body.current).toBeNull();
    });

    test('echoes current when provided', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ device_id: 'esp32-02', voltage: 230, current: 1.5 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('NORMAL');
      expect(res.body.current).toBe(1.5);
    });

    test('responds 400 when voltage is missing', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ device_id: 'esp32-01' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'voltage (number) is required' });
    });

    test('responds 400 when device_id is missing', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ voltage: 230 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'device_id (string) is required' });
    });

    test('responds 400 when voltage is not a number', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ device_id: 'esp32-01', voltage: 'high' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'voltage (number) is required' });
    });
  });
});
