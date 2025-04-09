import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';

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

  const json = await response.json() as { token: string };
  return json.token;
}

async function searchPatentFields(args: { query: string; field: string; lang?: string; limit?: number; offset?: number }): Promise<ServerResult> {
  const token = await getAccessToken();
  const response = await fetch('https://connect.patsnap.com/patent-field/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: args.query,
      field: args.field,
      lang: args.lang ?? 'cn',
      limit: args.limit ?? 50,
      offset: args.offset ?? 0
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to search patent fields: ${text}`);
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
        name: 'search_patent_fields',
        description: 'Search patent statistics using PatSnap Analytics Query Search and Filter API',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Analytics query string'
            },
            field: {
              type: 'string',
              description: 'Comma-separated field codes (e.g., ASSIGNEE, INVENTOR)'
            },
            lang: {
              type: 'string',
              description: 'Language code (cn, en, jp)'
            },
            limit: {
              type: 'number',
              description: 'Number of results to return (default 50)'
            },
            offset: {
              type: 'number',
              description: 'Offset for pagination (default 0)'
            }
          },
          required: ['query', 'field']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  const { name, arguments: args } = req.params;
  if (name === 'search_patent_fields') {
    if (!args || !('query' in args) || !('field' in args)) {
      throw new McpError(400, 'Missing required argument: query or field');
    }
    return await searchPatentFields(args as { query: string; field: string; lang?: string; limit?: number; offset?: number });
  } else {
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
