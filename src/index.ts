import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';

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
  if (PATSNAP_CLIENT_ID) params.append('apikey', PATSNAP_CLIENT_ID);

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

async function getWordCloud(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (args.keywords) params.append('keywords', args.keywords);
  if (args.ipc) params.append('ipc', args.ipc);
  if (args.apply_start_time) params.append('apply_start_time', args.apply_start_time);
  if (args.apply_end_time) params.append('apply_end_time', args.apply_end_time);
  if (args.public_start_time) params.append('public_start_time', args.public_start_time);
  if (args.public_end_time) params.append('public_end_time', args.public_end_time);
  if (args.authority) params.append('authority', args.authority);
  if (args.lang) params.append('lang', args.lang);
  else params.append('lang', 'en');
  if (PATSNAP_CLIENT_ID) params.append('apikey', PATSNAP_CLIENT_ID);

  const url = `https://connect.patsnap.com/insights/word-cloud?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to get word cloud: ${text}`);
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

async function getWheelOfInnovation(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (args.keywords) params.append('keywords', args.keywords);
  if (args.ipc) params.append('ipc', args.ipc);
  if (args.apply_start_time) params.append('apply_start_time', args.apply_start_time);
  if (args.apply_end_time) params.append('apply_end_time', args.apply_end_time);
  if (args.public_start_time) params.append('public_start_time', args.public_start_time);
  if (args.public_end_time) params.append('public_end_time', args.public_end_time);
  if (args.authority) params.append('authority', args.authority);
  if (args.lang) params.append('lang', args.lang);
  else params.append('lang', 'en');
  if (PATSNAP_CLIENT_ID) params.append('apikey', PATSNAP_CLIENT_ID);

  const url = `https://connect.patsnap.com/insights/wheel-of-innovation?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to get wheel of innovation: ${text}`);
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

async function getTopAuthoritiesOfOrigin(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (args.keywords) params.append('keywords', args.keywords);
  if (args.ipc) params.append('ipc', args.ipc);
  if (args.apply_start_time) params.append('apply_start_time', args.apply_start_time);
  if (args.apply_end_time) params.append('apply_end_time', args.apply_end_time);
  if (args.public_start_time) params.append('public_start_time', args.public_start_time);
  if (args.public_end_time) params.append('public_end_time', args.public_end_time);
  if (args.authority) params.append('authority', args.authority);
  if (args.lang) params.append('lang', args.lang);
  else params.append('lang', 'en');
  if (PATSNAP_CLIENT_ID) params.append('apikey', PATSNAP_CLIENT_ID);

  const url = `https://connect.patsnap.com/insights/priority-country?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new McpError(response.status, `Failed to get top authorities of origin: ${text}`);
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
        description: 'Analyze annual application and issued trends for patents. Use this tool to understand the trends of patents related to specific technology fields or keywords. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'string',
              description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"'
            },
            ipc: {
              type: 'string',
              description: 'Patent IPC classification code. Used to specify a particular technology field.'
            },
            apply_start_time: {
              type: 'string',
              description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.'
            },
            apply_end_time: {
              type: 'string',
              description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.'
            },
            public_start_time: {
              type: 'string',
              description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.'
            },
            public_end_time: {
              type: 'string',
              description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.'
            },
            authority: {
              type: 'string',
              description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP'
            }
          }
        }
      },
      {
        name: 'get_word_cloud',
        description: 'Obtain a snapshot of frequently occurring keywords and phrases from the most recent 5,000 published patents in a technology field. Use this tool to identify commonly used terms in the technology space for refining patent searches. Returns up to 100 keywords. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'string',
              description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"'
            },
            ipc: {
              type: 'string',
              description: 'Patent IPC classification code. Used to specify a particular technology field.'
            },
            apply_start_time: {
              type: 'string',
              description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.'
            },
            apply_end_time: {
              type: 'string',
              description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.'
            },
            public_start_time: {
              type: 'string',
              description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.'
            },
            public_end_time: {
              type: 'string',
              description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.'
            },
            authority: {
              type: 'string',
              description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP'
            },
            lang: {
              type: 'string',
              description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).'
            }
          }
        }
      },
      {
        name: 'get_wheel_of_innovation',
        description: 'Provides a two-tiered view of keywords and phrases in a technology space, categorized into a hierarchy. Useful for identifying common terms and their associations. Based on the most recent 5,000 publications. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'string',
              description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"'
            },
            ipc: {
              type: 'string',
              description: 'Patent IPC classification code. Used to specify a particular technology field.'
            },
            apply_start_time: {
              type: 'string',
              description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.'
            },
            apply_end_time: {
              type: 'string',
              description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.'
            },
            public_start_time: {
              type: 'string',
              description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.'
            },
            public_end_time: {
              type: 'string',
              description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.'
            },
            authority: {
              type: 'string',
              description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP'
            },
            lang: {
              type: 'string',
              description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).'
            }
          }
        }
      }
      ,
      {
        name: 'get_top_authorities_of_origin',
        description: 'Returns the top authorities (priority countries) of origin for patents matching the given criteria. Useful for analyzing which countries are the main sources of priority filings in a technology field. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'string',
              description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"'
            },
            ipc: {
              type: 'string',
              description: 'Patent IPC classification code. Used to specify a particular technology field.'
            },
            apply_start_time: {
              type: 'string',
              description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.'
            },
            apply_end_time: {
              type: 'string',
              description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.'
            },
            public_start_time: {
              type: 'string',
              description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.'
            },
            public_end_time: {
              type: 'string',
              description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.'
            },
            authority: {
              type: 'string',
              description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP'
            },
            lang: {
              type: 'string',
              description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).'
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
  } else if (name === 'get_word_cloud') {
    return await getWordCloud(args as { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string });
  } else if (name === 'get_wheel_of_innovation') {
    return await getWheelOfInnovation(args as { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string });
  } else if (name === 'get_top_authorities_of_origin') {
    return await getTopAuthoritiesOfOrigin(args as { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string });
  } else {
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
