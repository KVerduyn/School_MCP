#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { CalendarData } from './calendar-data.js';
const calendarData = new CalendarData();
const server = new Server({
    name: 'school-vacation-mcp',
    version: '1.0.0',
    capabilities: {
        tools: {},
    },
});
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
                const { date, region } = args;
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
                const { region, year } = args;
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
    }
    catch (error) {
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
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('School Vacation MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map