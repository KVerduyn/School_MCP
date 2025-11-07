# School Vacation MCP Server

A Model Context Protocol (MCP) server for querying school vacation calendars across Belgium, Netherlands, and Luxembourg (2019-2028).

**Protocol Version**: MCP 2025-06-18
**SDK Version**: @modelcontextprotocol/sdk v1.21.0

## Features

- 🗓️ School vacation calendar data for 2019-2028
- 🌍 Multi-region support: Belgium (Flanders, Wallonia), Netherlands (North, Middle, South), Luxembourg
- 🔧 Three tools: check dates, get vacation periods, list regions
- 🔒 Token-based authentication for production
- 📝 Audit logging for all requests
- 🚀 Multiple deployment modes: stdio, HTTP, Docker
- 🔗 LibreChat integration ready (see [LIBRECHAT_INTEGRATION.md](LIBRECHAT_INTEGRATION.md))

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Development Mode (No Authentication)

```bash
# stdio server (for MCP clients)
npm run dev

# HTTP+MCP server (for REST and MCP clients)
npm run dev:mcp
```

### Production Mode (With Authentication)

```bash
# Generate a secure token
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)

# Or set a custom token
export MCP_AUTH_TOKEN="your-secret-token"

# Start the server
npm run build
npm run start:mcp
```

### Docker Deployment

```bash
# Set auth token
echo "MCP_AUTH_TOKEN=your-secret-token" > .env

# Start with Docker Compose
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

### LibreChat Integration

This server is configured to work with LibreChat on the `LibreChat` Docker network. See the complete integration guide: **[LIBRECHAT_INTEGRATION.md](LIBRECHAT_INTEGRATION.md)**

Quick integration:
```bash
# From LibreChat container, MCP server is accessible at:
http://school-vacation-mcp:3000/mcp
```

## Available Tools

### 1. check_school_vacation

Check if a specific date is a school vacation day in a given region.

**Parameters**:
- `date` (string, required): Date in DD/MM/YYYY format (e.g., "25/12/2024")
- `region` (string, required): One of: flanders, wallonia, north-netherlands, middle-netherlands, south-netherlands, luxembourg

**Example**:
```json
{
  "name": "check_school_vacation",
  "arguments": {
    "date": "25/12/2024",
    "region": "flanders"
  }
}
```

### 2. get_vacation_periods

Get all school vacation periods for a region, optionally filtered by year.

**Parameters**:
- `region` (string, required): Region code
- `year` (number, optional): Year between 2019-2028

**Example**:
```json
{
  "name": "get_vacation_periods",
  "arguments": {
    "region": "flanders",
    "year": 2024
  }
}
```

### 3. get_supported_regions

Get a list of all supported regions.

**Parameters**: None

**Example**:
```json
{
  "name": "get_supported_regions",
  "arguments": {}
}
```

## Server Modes

### 1. stdio Server (Standard MCP)

For integration with MCP clients like Claude Desktop:

```bash
npm run start
```

**Configuration for Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "school-vacation": {
      "command": "node",
      "args": ["/path/to/School_MCP/dist/index.js"]
    }
  }
}
```

### 2. HTTP Server (REST API)

Basic REST API without MCP protocol:

```bash
npm run start:http
```

Endpoints:
- `GET /health` - Health check
- `GET /ping` - Connectivity test
- `POST /tools/*` - Tool execution endpoints

### 3. Combined HTTP+MCP Server (Recommended)

Supports both REST API and MCP JSON-RPC 2.0 protocol:

```bash
npm run start:mcp
```

Endpoints:
- `GET /health` - Health check
- `GET /ping` - Connectivity test
- `POST /mcp` - MCP JSON-RPC 2.0 endpoint (authentication required in production)

## API Examples

### MCP Protocol (JSON-RPC 2.0)

**Initialize**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

**List Tools**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

**Call Tool**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "check_school_vacation",
      "arguments": {
        "date": "25/12/2024",
        "region": "flanders"
      }
    }
  }'
```

## Authentication

### Development Mode

When `MCP_AUTH_TOKEN` is not set, authentication is **disabled**. This is suitable for local development only.

```bash
npm run dev:mcp
# Server runs without authentication
```

### Production Mode

When `MCP_AUTH_TOKEN` is set, all requests to `/mcp` endpoint require authentication:

```bash
export MCP_AUTH_TOKEN="your-secret-token"
npm run start:mcp
```

**Request with authentication**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Without authentication** (will return 401 error):
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Available variables:
- `MCP_AUTH_TOKEN` - Authentication token (leave empty for dev mode)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Docker Configuration

Edit `docker-compose.yml` to configure the Docker deployment:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN:-}
```

## MCP 2025-06-18 Compliance

This server is compliant with the MCP 2025-06-18 specification:

✅ **Implemented**:
- JSON-RPC 2.0 protocol
- Protocol version 2025-06-18
- Capability negotiation
- Tool definitions with JSON Schema
- Proper error handling
- Token-based authentication
- Audit logging

⚠️ **Optional** (not implemented):
- Full OAuth 2.0 / RFC 8707 (using basic token auth)
- Elicitation support
- Structured output schemas (Zod validation)
- Rate limiting

See [MCP_COMPLIANCE.md](MCP_COMPLIANCE.md) for detailed compliance analysis.

## Project Structure

```
School_MCP/
├── src/
│   ├── calendar-data.ts        # Core calendar data logic
│   ├── index.ts                # stdio MCP server
│   ├── http-server.ts          # REST API server
│   ├── mcp-http-server.ts      # Combined HTTP+MCP server
│   └── auth.ts                 # Authentication middleware
├── dist/                       # Compiled JavaScript
├── kalender 2019_2028.csv      # Calendar data
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── Dockerfile                  # Docker build config
├── docker-compose.yml          # Docker Compose config
├── MCP_COMPLIANCE.md          # Compliance report
├── UPGRADE_SUMMARY.md         # Upgrade guide
└── README.md                  # This file
```

## Data Coverage

- **Regions**: Belgium (Flanders, Wallonia), Netherlands (North, Middle, South), Luxembourg
- **Years**: 2019-2028
- **Data includes**: Weekends, holidays, school vacation flags per region

## Development

### Build

```bash
npm run build
```

### Run in development mode

```bash
# stdio server
npm run dev

# HTTP server
npm run dev:http

# Combined HTTP+MCP server
npm run dev:mcp
```

### Testing

```bash
# Test stdio server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js

# Test HTTP server
npm run dev:mcp &
curl http://localhost:3000/health
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Security Best Practices

🔒 **For Production Deployment**:

1. **Always set `MCP_AUTH_TOKEN`** - Never run without authentication in production
2. **Use HTTPS/TLS** - Encrypt traffic in production
3. **Strong tokens** - Generate with `openssl rand -hex 32`
4. **Rotate tokens** - Change authentication tokens regularly
5. **Monitor logs** - Review audit logs for suspicious activity
6. **Network isolation** - Use firewall rules to restrict access
7. **CORS configuration** - Set specific origins, not wildcard

See [MCP_COMPLIANCE.md](MCP_COMPLIANCE.md#security-best-practices) for detailed security recommendations.

## Troubleshooting

### Port already in use

```bash
# Kill existing node processes
pkill node

# Or use a different port
PORT=3001 npm run start:mcp
```

### Authentication errors

```bash
# Check if token is set
echo $MCP_AUTH_TOKEN

# Test without authentication in dev mode
unset MCP_AUTH_TOKEN
npm run dev:mcp
```

### Docker issues

```bash
# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check logs
docker-compose logs -f
```

## Upgrade Notes

This server was recently upgraded to MCP 2025-06-18. See [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) for:
- Changes made during upgrade
- Breaking changes from SDK v0.4.0 to v1.21.0
- Migration guide for custom code

## References

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Documentation](https://modelcontextprotocol.io/docs)

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]

---

**Status**: ✅ Production Ready
**Protocol**: MCP 2025-06-18
**SDK**: v1.21.0
**Last Updated**: 2025-11-07
