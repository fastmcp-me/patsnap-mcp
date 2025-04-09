import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
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

  const json = await response.json() as { token: string };
  return json.token;
}

async function searchPatents(args: { query_text: string; collapse_type?: string; collapse_by?: string; collapse_order?: string }): Promise<ServerResult> {
  const token = await getAccessToken();
  const response = await fetch('https://connect.patsnap.com/search/patent/query-search-count', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query_text: args.query_text,
      collapse_type: args.collapse_type,
      collapse_by: args.collapse_by,
      collapse_order: args.collapse_order
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to search patents: ${text}`);
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


async function getPatentByNumber(args: { patentNumber: string }): Promise<ServerResult> {
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
      },
      {
        name: 'search_patents',
        description: 'Search patents in PatSnap database',
        inputSchema: {
          type: 'object',
          properties: {
            query_text: {
              type: 'string',
              description: 'Analytics query'
            },
            collapse_type: {
              type: 'string',
              description: 'Collapse type (ALL, APNO, DOCDB, INPADOC, EXTEND)'
            },
            collapse_by: {
              type: 'string',
              description: 'Collapse by (APD, PBD, AUTHORITY, SCORE)'
            },
            collapse_order: {
              type: 'string',
              description: 'Collapse order (OLDEST, LATEST)'
            }
          },
          required: ['query_text']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === 'get_patent_by_number') {
    if (!args || !('patentNumber' in args)) {
      throw new McpError(400, 'Missing required argument: patentNumber');
    }
    return await getPatentByNumber(args as { patentNumber: string });
  } else if (name === 'search_patents') {
    if (!args || !('query_text' in args)) {
      throw new McpError(400, 'Missing required argument: query_text');
    }
    return await searchPatents(args as { query_text: string; collapse_type?: string; collapse_by?: string; collapse_order?: string });
  } else {
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
