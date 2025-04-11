import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';

const PATSNAP_CLIENT_ID = process.env.PATSNAP_CLIENT_ID;
const PATSNAP_CLIENT_SECRET = process.env.PATSNAP_CLIENT_SECRET;

const PATSNAP_API_KEY = process.env.PATSNAP_API_KEY;


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
  fs.appendFileSync('patsnap_token_response.log', `\nPatSnap token response: ${JSON.stringify(json, null, 2)}\n`);
  const token = json.access_token || json.token || (json.data && json.data.token);
  if (!token) {
    throw new McpError(500, 'Failed to parse access token');
  }
  return token;
}

async function getPatentTrends(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string }): Promise<ServerResult> {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (args.keywords) params.append('keywords', args.keywords);
  if (args.ipc) params.append('ipc', args.ipc);
  if (args.apply_start_time) params.append('apply_start_time', args.apply_start_time);
  if (args.apply_end_time) params.append('apply_end_time', args.apply_end_time);
  if (args.public_start_time) params.append('public_start_time', args.public_start_time);
  if (args.public_end_time) params.append('public_end_time', args.public_end_time);
  if (args.authority) params.append('authority', args.authority);
  params.append('apikey', PATSNAP_API_KEY ?? '');

  const url = `https://connect.patsnap.com/insights/patent-trends?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to get patent trends: ${text}`);
  }
  const json = await response.json();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(json, null, 2)
      }
    ]
  };
}





const server = new Server(
  {
    name: 'patsnap-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {
      },
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_patent_trends',
        description: 'Analyze annual application and issued trends for patents (keywords or IPC required)',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'string',
              description: 'Keywords for search (title and abstract)'
            },
            ipc: {
              type: 'string',
              description: 'IPC classification code'
            },
            apply_start_time: {
              type: 'string',
              description: 'Application start year (yyyy)'
            },
            apply_end_time: {
              type: 'string',
              description: 'Application end year (yyyy)'
            },
            public_start_time: {
              type: 'string',
              description: 'Publication start year (yyyy)'
            },
            public_end_time: {
              type: 'string',
              description: 'Publication end year (yyyy)'
            },
            authority: {
              type: 'string',
              description: 'Patent authority (e.g., CN, US, JP)'
            }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  const { name, arguments: args } = req.params;
  if (name === 'get_patent_trends') {
    return await getPatentTrends(args as { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string });
  } else {
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
