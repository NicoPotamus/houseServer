// Express middleware setup
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

export function setupMiddleware(app: express.Application): void {
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({
    origin: 'http://localhost:8081',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
  }));
}
