#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { CalendarData } from './calendar-data.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { authMiddleware, auditLogMiddleware } from './auth.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const calendarData = new CalendarData();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'school-vacation-mcp'
  });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// SSE endpoint for MCP (LibreChat compatible)
app.get('/sse', auditLogMiddleware, async (req, res) => {
  console.log('SSE connection request received');

  // Create a new MCP server instance for this connection
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

  // Create SSE transport
  const transport = new SSEServerTransport('/message', res);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
  });

  // Connect server to transport
  await server.connect(transport);
  console.log('SSE connection established');
});

// POST endpoint for messages (required by SSE transport)
app.post('/message', express.text({ type: '*/*' }), async (req, res) => {
  console.log('Message received:', req.body);
  // SSE transport handles this internally
  res.status(202).end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`School Vacation MCP Server (SSE) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
