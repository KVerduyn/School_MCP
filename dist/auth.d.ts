/**
 * Basic authentication middleware for MCP HTTP server
 *
 * This provides a simple token-based authentication mechanism.
 * For production use, consider implementing full OAuth 2.0 as per MCP 2025-06-18 spec.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Express middleware to validate authentication token
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Logs request details for audit purposes
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export declare function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map