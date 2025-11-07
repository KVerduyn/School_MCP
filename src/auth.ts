/**
 * Basic authentication middleware for MCP HTTP server
 *
 * This provides a simple token-based authentication mechanism.
 * For production use, consider implementing full OAuth 2.0 as per MCP 2025-06-18 spec.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Authentication token from environment variable
 * If not set, authentication is disabled (development mode)
 */
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

/**
 * Express middleware to validate authentication token
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip authentication if no token is configured
  if (!AUTH_TOKEN) {
    console.warn('WARNING: MCP_AUTH_TOKEN not set - authentication is DISABLED');
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: 'Unauthorized - missing authorization header',
        data: {
          hint: 'Include "Authorization: Bearer <token>" header'
        }
      }
    });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (token !== AUTH_TOKEN) {
    res.status(403).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32002,
        message: 'Forbidden - invalid authentication token'
      }
    });
    return;
  }

  // Token is valid, continue to next middleware
  next();
}

/**
 * Logs request details for audit purposes
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    mcpMethod: req.body?.method,
    mcpParams: req.body?.params ? Object.keys(req.body.params) : undefined
  };

  console.log('[AUDIT]', JSON.stringify(logEntry));
  next();
}
