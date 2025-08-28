import express from 'express';
import cors from 'cors';
import { CalendarData } from './calendar-data.js';
const app = express();
const PORT = process.env.PORT || 3000;
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
// MCP endpoint - returns server info and available tools
app.get('/mcp', (req, res) => {
    res.json({
        name: 'school-vacation-mcp',
        version: '1.0.0',
        description: 'MCP server for school vacation calendar lookups',
        tools: [
            {
                name: 'check_school_vacation',
                description: 'Check if a specific date is a school vacation day in a given region',
                parameters: {
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
                parameters: {
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
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
        ],
    });
});
// Tool execution endpoints
app.post('/tools/check_school_vacation', (req, res) => {
    try {
        const { date, region } = req.body;
        if (!date || !region) {
            return res.status(400).json({
                error: 'Missing required parameters: date and region'
            });
        }
        const isVacation = calendarData.isSchoolVacation(date, region);
        res.json({
            date,
            region,
            isSchoolVacation: isVacation,
            message: isVacation
                ? `${date} is a school vacation day in ${region}`
                : `${date} is not a school vacation day in ${region}`
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
app.post('/tools/get_vacation_periods', (req, res) => {
    try {
        const { region, year } = req.body;
        if (!region) {
            return res.status(400).json({
                error: 'Missing required parameter: region'
            });
        }
        const periods = calendarData.getVacationPeriods(region, year);
        res.json({
            region,
            year: year || 'all years',
            vacationPeriods: periods,
            totalPeriods: periods.length
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
app.post('/tools/get_supported_regions', (req, res) => {
    try {
        const regions = calendarData.getSupportedRegions();
        res.json({
            supportedRegions: regions,
            description: 'These are the available regions for school vacation lookups'
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
app.listen(PORT, () => {
    console.log(`School Vacation MCP HTTP Server running on port ${PORT}`);
});
//# sourceMappingURL=http-server.js.map