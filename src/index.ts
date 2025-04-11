import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';

const PATSNAP_CLIENT_ID = process.env.PATSNAP_CLIENT_ID;
const PATSNAP_CLIENT_SECRET = process.env.PATSNAP_CLIENT_SECRET;
const PATSNAP_API_BASE_URL = 'https://connect.patsnap.com'; // Define base URL as constant
const LOG_FILE_PATH = 'patsnap_token_response.log'; // Define log file path

async function getAccessToken(): Promise<string> {
  if (!PATSNAP_CLIENT_ID || !PATSNAP_CLIENT_SECRET) {
    throw new McpError(500, 'Missing PATSNAP_CLIENT_ID or PATSNAP_CLIENT_SECRET');
  }

  const response = await fetch(`${PATSNAP_API_BASE_URL}/oauth/token`, { // Use base URL constant
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
  // Consider using async file append and error handling
  try {
    fs.appendFileSync(LOG_FILE_PATH, `\nPatSnap token response at ${new Date().toISOString()}: ${JSON.stringify(json, null, 2)}\n`);
  } catch (err) {
      console.error("Failed to write to log file:", err);
      // Decide if this should be a critical error or just logged
  }
  const token = json.access_token || json.token || (json.data && json.data.token);
  if (!token || typeof token !== 'string') { // Add type check for token
    throw new McpError(500, 'Failed to parse access token from response');
  }
  return token;
}

// Helper function to build URLSearchParams, avoiding repetition
function buildCommonSearchParams(args: Record<string, string | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key in args) {
        if (Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined) {
            params.append(key, args[key] as string);
        }
    }
    if (PATSNAP_CLIENT_ID) {
        params.append('apikey', PATSNAP_CLIENT_ID);
    }
    return params;
}

// Helper function for making API calls, avoiding repetition
async function callPatsnapApi(endpoint: string, params: URLSearchParams, errorContext: string): Promise<ServerResult> {
    const token = await getAccessToken();
    const url = `${PATSNAP_API_BASE_URL}/insights/${endpoint}?${params.toString()}`;
    console.log(`Calling PatSnap API: ${url}`); // Log the request URL

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            // 'Content-Type': 'application/json', // Not needed for GET
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`API Error (${response.status}) for ${endpoint}: ${text}`); // Log error details
        throw new McpError(response.status, `Failed to ${errorContext}: ${text}`);
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


// --- Existing Tool Functions (using helpers for brevity, but structure maintained) ---

async function getPatentTrends(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  return callPatsnapApi('patent-trends', params, 'get patent trends');
}

async function getWordCloud(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('word-cloud', params, 'get word cloud');
}

async function getWheelOfInnovation(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('wheel-of-innovation', params, 'get wheel of innovation');
}

async function getTopAuthoritiesOfOrigin(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string; lang?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('priority-country', params, 'get top authorities of origin');
}

async function getMostCitedPatents(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  return callPatsnapApi('most-cited', params, 'get most cited patents');
}

// +++ NEW FUNCTION +++
// [A006] Top Inventors
async function getTopInventors(args: { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string }): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  // No 'lang' parameter for this endpoint
  return callPatsnapApi('inventor-ranking', params, 'get top inventors');
}
// +++ END NEW FUNCTION +++


const server = new Server(
  {
    name: 'patsnap-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // --- Existing Tool Definitions ---
      {
        name: 'get_patent_trends',
        description: 'Analyze annual application and issued trends for patents. Use this tool to understand the trends of patents related to specific technology fields or keywords. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"' },
            ipc: { type: 'string', description: 'Patent IPC classification code. Used to specify a particular technology field.' },
            apply_start_time: { type: 'string', description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.' },
            apply_end_time: { type: 'string', description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.' },
            public_start_time: { type: 'string', description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.' },
            public_end_time: { type: 'string', description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.' },
            authority: { type: 'string', description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP' }
          }
        }
      },
      {
        name: 'get_word_cloud',
        description: 'Obtain a snapshot of frequently occurring keywords and phrases from the most recent 5,000 published patents in a technology field. Use this tool to identify commonly used terms in the technology space for refining patent searches. Returns up to 100 keywords. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"' },
            ipc: { type: 'string', description: 'Patent IPC classification code. Used to specify a particular technology field.' },
            apply_start_time: { type: 'string', description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.' },
            apply_end_time: { type: 'string', description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.' },
            public_start_time: { type: 'string', description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.' },
            public_end_time: { type: 'string', description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.' },
            authority: { type: 'string', description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP' },
            lang: { type: 'string', description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).' }
          }
        }
      },
      {
        name: 'get_wheel_of_innovation',
        description: 'Provides a two-tiered view of keywords and phrases in a technology space, categorized into a hierarchy. Useful for identifying common terms and their associations. Based on the most recent 5,000 publications. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"' },
            ipc: { type: 'string', description: 'Patent IPC classification code. Used to specify a particular technology field.' },
            apply_start_time: { type: 'string', description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.' },
            apply_end_time: { type: 'string', description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.' },
            public_start_time: { type: 'string', description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.' },
            public_end_time: { type: 'string', description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.' },
            authority: { type: 'string', description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP' },
            lang: { type: 'string', description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).' }
          }
        }
      },
      {
        name: 'get_most_cited_patents',
        description: 'View the top records that have been cited most frequently by other records to understand which records are more prolific and have had their technology built upon by others. These patents are likely to be more influential and may represent the core, innovative technology of the organization it represents. Returns at most Top 10 patent information. Note: Search must contain either keywords or IPC. If search contains both parameters, IPC will be prioritized.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Searches for keywords within patent title and summary. Supports AND, OR, NOT search logic, for example "mobile phone AND (screen OR battery)".' },
            ipc: { type: 'string', description: 'Patent IPC classification' },
            apply_start_time: { type: 'string', description: 'Patent apply date from, format:yyyy' },
            apply_end_time: { type: 'string', description: 'Patent apply date to, format:yyyy' },
            public_start_time: { type: 'string', description: 'Patent publication date from, format:yyyy' },
            public_end_time: { type: 'string', description: 'Patent publication date to, format:yyyy' },
            authority: { type: 'string', description: 'Select the authority of the patent, the default query all databases, eg CN、US、EP、JP.' }
          }
        }
      },
      {
        name: 'get_top_authorities_of_origin',
        description: 'Returns the top authorities (priority countries) of origin for patents matching the given criteria. Useful for analyzing which countries are the main sources of priority filings in a technology field. Either keywords or IPC classification must be specified.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Keywords to search within patent title and abstract. Supports AND, OR, NOT search logic. Example: "mobile phone AND (screen OR battery)"' },
            ipc: { type: 'string', description: 'Patent IPC classification code. Used to specify a particular technology field.' },
            apply_start_time: { type: 'string', description: 'Patent application start year (yyyy format). Specifies the start year of the analysis period.' },
            apply_end_time: { type: 'string', description: 'Patent application end year (yyyy format). Specifies the end year of the analysis period.' },
            public_start_time: { type: 'string', description: 'Patent publication start year (yyyy format). Specifies the start year of the publication data analysis period.' },
            public_end_time: { type: 'string', description: 'Patent publication end year (yyyy format). Specifies the end year of the publication data analysis period.' },
            authority: { type: 'string', description: 'Patent authority. Used to target patents from specific countries or regions. Example: CN, US, JP' },
            lang: { type: 'string', description: 'Language setting. Default is "en" (English). You can choose "cn" (Chinese) or "en" (English).' }
          }
        }
      },
      // +++ NEW TOOL DEFINITION +++
      {
        name: 'get_top_inventors',
        description: 'Shows the top inventors in the technology field. Useful for evaluating top performers or recruiting. Returns up to the top 10 inventors. Note: Search must contain either keywords or IPC. If search contains both parameters, IPC will be prioritized.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Searches for keywords within patent title and summary. Supports AND, OR, NOT search logic, for example "mobile phone AND (screen OR battery)".' },
            ipc: { type: 'string', description: 'Patent IPC classification' },
            apply_start_time: { type: 'string', description: 'Patent apply date from, format:yyyy' },
            apply_end_time: { type: 'string', description: 'Patent apply date to, format:yyyy' },
            public_start_time: { type: 'string', description: 'Patent publication date from, format:yyyy' },
            public_end_time: { type: 'string', description: 'Patent publication date to, format:yyyy' },
            authority: { type: 'string', description: 'Select the authority of the patent, the default query all databases, eg CN、US、EP、JP.' }
          }
        }
      }
      // +++ END NEW TOOL DEFINITION +++
    ]
  };
});

// Define argument types for better readability and potential future validation
type BasePatentArgs = { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string };
type LangPatentArgs = BasePatentArgs & { lang?: string };

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  // Basic validation of request structure
  if (!req || typeof req !== 'object' || !req.params || typeof req.params !== 'object') {
       throw new McpError(400, 'Invalid CallToolRequest format.');
  }

  const { name, arguments: args } = req.params;

  if (typeof name !== 'string' || !name) {
       throw new McpError(400, 'Tool name is missing or invalid.');
  }
   if (typeof args !== 'object' || args === null) {
       // Allow empty arguments object {}
       // throw new McpError(400, 'Tool arguments are missing or invalid.');
       console.warn(`Tool ${name} called with null or non-object arguments.`);
   }

  // Use type assertion cautiously, assuming SDK or caller provides correct structure
  const toolArgs = args || {}; // Ensure args is at least an empty object

  if (name === 'get_patent_trends') {
    return await getPatentTrends(toolArgs as BasePatentArgs);
  } else if (name === 'get_word_cloud') {
    return await getWordCloud(toolArgs as LangPatentArgs);
  } else if (name === 'get_wheel_of_innovation') {
    return await getWheelOfInnovation(toolArgs as LangPatentArgs);
  } else if (name === 'get_top_authorities_of_origin') {
    return await getTopAuthoritiesOfOrigin(toolArgs as LangPatentArgs);
  } else if (name === 'get_most_cited_patents') {
    return await getMostCitedPatents(toolArgs as BasePatentArgs);
  // +++ NEW TOOL HANDLER +++
  } else if (name === 'get_top_inventors') {
    return await getTopInventors(toolArgs as BasePatentArgs);
  // +++ END NEW TOOL HANDLER +++
  } else {
    console.error(`Unknown tool called: ${name}`); // Log unknown tool calls
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
console.log("PatSnap MCP Server started and connected via Stdio."); // Add a startup message
