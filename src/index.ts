import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const PATSNAP_CLIENT_ID = process.env.PATSNAP_CLIENT_ID;
const PATSNAP_CLIENT_SECRET = process.env.PATSNAP_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
  if (!PATSNAP_CLIENT_ID || !PATSNAP_CLIENT_SECRET) {
    throw new McpError(500, 'Missing PATSNAP_CLIENT_ID or PATSNAP_CLIENT_SECRET');
  }

  const response = await fetch('https://connect.patsnap.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${PATSNAP_CLIENT_ID}:${PATSNAP_CLIENT_SECRET}`).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to get token: ${text}`);
  }

  const json = await response.json();
  return json.token;
}

async function getPatentByNumber(args: { patentNumber: string }) {
  const token = await getAccessToken();
  const response = await fetch(`https://openapi.patsnap.com/api/v1/patents/${args.patentNumber}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to fetch patent: ${text}`);
  }

  return await response.json();
}

const server = new Server(
  {
    name: 'patsnap-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {
        get_patent_by_number: {
          description: 'Fetch patent data from PatSnap by patent number',
          inputSchema: {
            type: 'object',
            properties: {
              patentNumber: {
                type: 'string',
                description: 'The patent number to retrieve'
              }
            },
            required: ['patentNumber']
          },
          handler: getPatentByNumber
        }
      },
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_patent_by_number',
        description: 'Fetch patent data from PatSnap by patent number',
        inputSchema: {
          type: 'object',
          properties: {
            patentNumber: {
              type: 'string',
              description: 'The patent number to retrieve'
            }
          },
          required: ['patentNumber']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === 'get_patent_by_number') {
    return await getPatentByNumber(args);
  } else {
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
