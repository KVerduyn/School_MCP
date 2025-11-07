# LibreChat Integration Guide

## Overview

This guide shows how to integrate the School Vacation MCP Server with LibreChat using Docker networking.

## Network Configuration

Both services are configured to use the `LibreChat` Docker network for communication.

### School Vacation MCP Server (This Project)

The docker-compose.yml is already configured:

```yaml
networks:
  LibreChat:
    name: LibreChat
    driver: bridge
```

## Integration Steps

### Option 1: Add to Existing LibreChat Installation

If you already have LibreChat running, modify your LibreChat's `docker-compose.yml`:

```yaml
services:
  librechat:
    # ... your existing LibreChat config ...
    networks:
      - LibreChat
    environment:
      # Add MCP server endpoint
      - MCP_SCHOOL_VACATION_URL=http://school-vacation-mcp:3000/mcp
      - MCP_SCHOOL_VACATION_TOKEN=${MCP_AUTH_TOKEN:-}

networks:
  LibreChat:
    name: LibreChat
    external: true  # Use the existing network created by MCP server
```

### Option 2: Combined docker-compose.yml

Create a combined `docker-compose.yml` that includes both services:

```yaml
version: '3.8'

services:
  librechat:
    image: ghcr.io/danny-avila/librechat:latest
    container_name: librechat
    ports:
      - "3080:3080"
    environment:
      - MCP_SCHOOL_VACATION_URL=http://school-vacation-mcp:3000/mcp
      - MCP_SCHOOL_VACATION_TOKEN=${MCP_AUTH_TOKEN:-}
      # ... other LibreChat env vars ...
    networks:
      - LibreChat
    depends_on:
      - school-vacation-mcp
    restart: unless-stopped

  school-vacation-mcp:
    build: ./School_MCP
    container_name: school-vacation-mcp
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN:-}
    networks:
      - LibreChat
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  LibreChat:
    name: LibreChat
    driver: bridge
```

## Deployment

### Step 1: Set Authentication Token (Optional)

```bash
# Create .env file
echo "MCP_AUTH_TOKEN=$(openssl rand -hex 32)" > .env
```

Or for development without authentication:
```bash
echo "MCP_AUTH_TOKEN=" > .env
```

### Step 2: Start Services

**If using separate docker-compose files:**

```bash
# Start MCP server first (creates network)
cd /path/to/School_MCP
docker-compose up -d

# Start LibreChat (joins existing network)
cd /path/to/LibreChat
docker-compose up -d
```

**If using combined docker-compose:**

```bash
docker-compose up -d
```

### Step 3: Verify Connection

```bash
# Check MCP server health
curl http://localhost:3000/health

# Test from LibreChat container
docker exec librechat curl http://school-vacation-mcp:3000/health
```

## LibreChat Configuration

### Add MCP Server to LibreChat

You'll need to configure LibreChat to recognize the MCP server. This typically involves:

1. **Environment Variables** (see above)
2. **LibreChat Config File** (`librechat.yaml` or similar):

```yaml
mcp:
  servers:
    - name: school-vacation
      url: http://school-vacation-mcp:3000/mcp
      protocol: mcp-2025-06-18
      auth:
        type: bearer
        token: ${MCP_AUTH_TOKEN}
      description: School vacation calendar for Belgium, Netherlands, and Luxembourg
```

### Available Tools

Once integrated, LibreChat users will have access to:

1. **check_school_vacation** - Check if a date is a school vacation
2. **get_vacation_periods** - Get all vacation periods for a region
3. **get_supported_regions** - List available regions

## Network Communication

### Internal Communication (Container-to-Container)

From LibreChat to MCP server:
```
http://school-vacation-mcp:3000/mcp
```

From MCP server to LibreChat (if needed):
```
http://librechat:3080
```

### External Access (Host-to-Container)

From your host machine:
```
# LibreChat
http://localhost:3080

# MCP Server
http://localhost:3000/mcp
```

## Authentication Scenarios

### Without Authentication (Development)

```bash
# Don't set MCP_AUTH_TOKEN
docker-compose up -d

# LibreChat can call without Bearer token
curl -X POST http://school-vacation-mcp:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### With Authentication (Production)

```bash
# Set strong token
export MCP_AUTH_TOKEN="your-secure-token-here"
docker-compose up -d

# LibreChat must include Bearer token
curl -X POST http://school-vacation-mcp:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-token-here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

## Testing the Integration

### 1. Test MCP Protocol Directly

```bash
# Initialize connection
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
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

# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# Check a vacation date
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
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

### 2. Test from LibreChat Container

```bash
# Enter LibreChat container
docker exec -it librechat bash

# Test connectivity
curl http://school-vacation-mcp:3000/health

# Test MCP endpoint
curl -X POST http://school-vacation-mcp:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 3. Test in LibreChat UI

Once integrated, try asking LibreChat:
- "Is December 25, 2024 a school vacation in Flanders?"
- "Show me all school vacation periods in 2024 for Wallonia"
- "What regions are supported for school vacation queries?"

## Monitoring

### View Logs

```bash
# MCP server logs
docker-compose logs -f school-vacation-mcp

# LibreChat logs
docker-compose logs -f librechat

# Both together
docker-compose logs -f
```

### Check Network

```bash
# List containers on LibreChat network
docker network inspect LibreChat

# Expected output shows both containers
```

## Troubleshooting

### Connection Refused

**Problem**: LibreChat can't reach MCP server

**Solution**:
```bash
# Verify both containers are on the same network
docker network inspect LibreChat

# Check MCP server is healthy
curl http://localhost:3000/health

# Check from LibreChat container
docker exec librechat curl http://school-vacation-mcp:3000/health
```

### Authentication Errors

**Problem**: 401 Unauthorized errors

**Solution**:
```bash
# Check if MCP_AUTH_TOKEN is set
docker exec school-vacation-mcp env | grep MCP_AUTH_TOKEN

# Ensure LibreChat has the same token
docker exec librechat env | grep MCP_AUTH_TOKEN

# Verify token matches in both .env files
```

### Container Not Found

**Problem**: `could not find container school-vacation-mcp`

**Solution**:
```bash
# Check container is running
docker ps | grep school-vacation-mcp

# Start MCP server
cd /path/to/School_MCP
docker-compose up -d

# Restart LibreChat
cd /path/to/LibreChat
docker-compose restart
```

### Network Doesn't Exist

**Problem**: `network LibreChat not found`

**Solution**:
```bash
# Create network manually
docker network create LibreChat

# Or start MCP server first (it creates the network)
cd /path/to/School_MCP
docker-compose up -d
```

## Security Considerations

### Production Deployment

For production use:

1. **Enable Authentication**:
   ```bash
   export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
   ```

2. **Don't Expose Port 3000** (optional):
   ```yaml
   # Remove or comment out in docker-compose.yml
   # ports:
   #   - "3000:3000"
   ```
   This keeps the MCP server accessible only within the Docker network.

3. **Use HTTPS** for external access:
   - Add nginx reverse proxy
   - Configure SSL certificates
   - Terminate TLS at the proxy

4. **Network Isolation**:
   ```yaml
   networks:
     LibreChat:
       internal: true  # No external access
   ```

5. **Limit CORS**:
   Update [src/mcp-http-server.ts](src/mcp-http-server.ts):
   ```typescript
   app.use(cors({
     origin: 'http://librechat:3080',
     credentials: true
   }));
   ```

## Architecture Diagram

```
┌─────────────────┐         ┌──────────────────────┐
│   Host Machine  │         │  LibreChat Network   │
│                 │         │   (Docker Bridge)    │
│  localhost:3080 ├────────▶│                      │
│  localhost:3000 │         │  ┌────────────────┐  │
└─────────────────┘         │  │   LibreChat    │  │
                            │  │   Container    │  │
                            │  │  :3080         │  │
                            │  └────────┬───────┘  │
                            │           │          │
                            │           │ http://  │
                            │           │ school-  │
                            │           │ vacation-│
                            │           │ mcp:3000 │
                            │           │          │
                            │           ▼          │
                            │  ┌────────────────┐  │
                            │  │  School        │  │
                            │  │  Vacation MCP  │  │
                            │  │  :3000         │  │
                            │  └────────────────┘  │
                            └──────────────────────┘
```

## Additional Resources

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [LibreChat Documentation](https://docs.librechat.ai/)
- [School Vacation MCP README](README.md)
- [MCP Compliance Report](MCP_COMPLIANCE.md)

## Support

For issues with:
- **MCP Server**: Check [MCP_COMPLIANCE.md](MCP_COMPLIANCE.md) and server logs
- **LibreChat**: Refer to LibreChat documentation
- **Docker Networking**: Use `docker network inspect LibreChat`

## Quick Start Checklist

- [ ] Set `MCP_AUTH_TOKEN` in .env file
- [ ] Build MCP server: `docker-compose build`
- [ ] Start MCP server: `docker-compose up -d`
- [ ] Verify health: `curl http://localhost:3000/health`
- [ ] Update LibreChat docker-compose.yml with network config
- [ ] Start LibreChat
- [ ] Test connection from LibreChat container
- [ ] Configure LibreChat to use MCP server
- [ ] Test tools in LibreChat UI

---

**Integration Status**: Ready for Production
**Protocol Version**: MCP 2025-06-18
**Authentication**: Optional (Token-based)

## SSE Transport (LibreChat Default)

LibreChat uses **SSE (Server-Sent Events)** transport by default. The MCP server now includes an SSE endpoint at `/sse`.

### SSE Endpoint

```
http://school-vacation-mcp:3000/sse
```

### LibreChat Configuration for SSE

Update your LibreChat MCP configuration:

```yaml
# In LibreChat config
mcp:
  servers:
    school-vacation:
      url: http://school-vacation-mcp:3000/sse
      transport: sse
      protocol: mcp-2025-06-18
```

Or via environment variables:

```bash
MCP_SCHOOL_VACATION_URL=http://school-vacation-mcp:3000/sse
MCP_SCHOOL_VACATION_TRANSPORT=sse
```

### Transport Options

The server now supports **two transports**:

1. **SSE** (recommended for LibreChat): `/sse`
2. **HTTP JSON-RPC**: `/mcp`

Use the SSE endpoint for LibreChat integration.

---

**Updated**: 2025-11-07 - Added SSE transport support
