#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { CalendarData } from './calendar-data.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  InitializeRequestSchema,
  Request,
  Result
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const calendarData = new CalendarData();

app.use(cors());
app.use(express.json());

// Create MCP Server instance
const mcpServer = new Server(
  {
    name: 'school-vacation-mcp',
    version: '1.0.0',
    capabilities: {
      tools: {},
    },
  }
);

// Setup MCP server handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
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

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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

// MCP streaming endpoint for LibreChat - JSON-RPC 2.0 format
app.post('/mcp', async (req, res) => {
  try {
    const request = req.body as any;
    console.log('MCP request:', JSON.stringify(request, null, 2));
    
    // Validate JSON-RPC 2.0 format
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request - missing or invalid jsonrpc version'
        }
      });
    }

    if (!request.id) {
      return res.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request - missing id'
        }
      });
    }
    
    // Handle different MCP request types
    if (request.method === 'initialize') {
      const result = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'school-vacation-mcp',
            version: '1.0.0',
          },
        }
      };
      res.json(result);
    } else if (request.method === 'tools/list') {
      const result = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
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
        }
      };
      res.json(result);
    } else if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;

      try {
        let toolResult;
        switch (name) {
          case 'check_school_vacation': {
            const { date, region } = args as { date: string; region: string };
            const isVacation = calendarData.isSchoolVacation(date, region);
            
            toolResult = {
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
            break;
          }

          case 'get_vacation_periods': {
            const { region, year } = args as { region: string; year?: number };
            const periods = calendarData.getVacationPeriods(region, year);
            
            toolResult = {
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
            break;
          }

          case 'get_supported_regions': {
            const regions = calendarData.getSupportedRegions();
            
            toolResult = {
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
            break;
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        res.json({
          jsonrpc: '2.0',
          id: request.id,
          result: toolResult
        });
      } catch (error) {
        res.json({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            data: { tool: name, arguments: args }
          }
        });
      }
    } else {
      res.json({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      });
    }
  } catch (error) {
    console.error('MCP request error:', error);
    res.json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`School Vacation MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});