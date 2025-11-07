#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { CalendarData } from './calendar-data.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { auditLogMiddleware } from './auth.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const calendarData = new CalendarData();

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.use(cors());
app.use(express.json());

// Create a shared MCP server instance
const server = new Server(
  {
    name: 'school-vacation-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Setup tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'check_school_vacation',
        description: 'Check if a specific date is a school vacation day in a given region',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in DD/MM/YYYY format (e.g., "01/01/2019")',
            },
            region: {
              type: 'string',
              description: 'Region to check (flanders, wallonia, north-netherlands, middle-netherlands, south-netherlands, luxembourg)',
              enum: ['flanders', 'wallonia', 'north-netherlands', 'middle-netherlands', 'south-netherlands', 'luxembourg']
            },
          },
          required: ['date', 'region'],
        },
      },
      {
        name: 'get_vacation_periods',
        description: 'Get all school vacation periods for a region, optionally filtered by year',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Region to get vacation periods for',
              enum: ['flanders', 'wallonia', 'north-netherlands', 'middle-netherlands', 'south-netherlands', 'luxembourg']
            },
            year: {
              type: 'number',
              description: 'Optional year to filter vacation periods (2019-2028)',
              minimum: 2019,
              maximum: 2028
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'get_supported_regions',
        description: 'Get list of all supported regions for school vacation lookups',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'check_school_vacation': {
        const { date, region } = args as { date: string; region: string };
        const isVacation = calendarData.isSchoolVacation(date, region);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                date,
                region,
                isSchoolVacation: isVacation,
                message: isVacation
                  ? `${date} is a school vacation day in ${region}`
                  : `${date} is not a school vacation day in ${region}`
              }, null, 2),
            },
          ],
        };
      }

      case 'get_vacation_periods': {
        const { region, year } = args as { region: string; year?: number };
        const periods = calendarData.getVacationPeriods(region, year);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                region,
                year: year || 'all years',
                vacationPeriods: periods,
                totalPeriods: periods.length
              }, null, 2),
            },
          ],
        };
      }

      case 'get_supported_regions': {
        const regions = calendarData.getSupportedRegions();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                supportedRegions: regions,
                description: 'These are the available regions for school vacation lookups'
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: name,
            arguments: args
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'school-vacation-mcp',
    activeSessions: Object.keys(transports).length
  });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// GET endpoint for SSE stream (Streamable HTTP requires this)
app.get('/mcp', async (req, res) => {
  console.log('SSE stream connection requested');

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    console.error('No valid session ID for SSE connection');
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Establishing SSE stream for session: ${sessionId}`);
  const transport = transports[sessionId];

  // Handle client disconnect
  req.on('close', () => {
    console.log(`SSE stream closed by client for session: ${sessionId}`);
  });

  // The transport will handle the SSE connection and keep it alive
  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('SSE stream error:', error);
  }
});

// Streamable HTTP endpoint for MCP (LibreChat compatible)
app.post('/mcp', auditLogMiddleware, async (req, res) => {
  console.log('Streamable HTTP MCP request received');

  try {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      console.log(`Reusing existing session: ${sessionId}`);
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      console.log('Creating new session for initialization request');
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          console.log(`Session initialized with ID: ${newSessionId}`);
          transports[newSessionId] = transport;
        },
        onsessionclosed: (closedSessionId: string) => {
          console.log(`Session closed: ${closedSessionId}`);
          delete transports[closedSessionId];
        }
      });

      // Connect the transport to the MCP server
      await server.connect(transport);

      // Handle the request - the onsessioninitialized callback will store the transport
      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      console.error('Invalid request: no valid session ID or not an initialization request');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided'
        },
        id: null
      });
      return;
    }

    // Handle the request with existing transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling Streamable HTTP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null
      });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`School Vacation MCP Server (Streamable HTTP) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log('Waiting for LibreChat connections...');
});
