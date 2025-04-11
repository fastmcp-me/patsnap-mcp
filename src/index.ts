import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
// Consider using fs.promises for async file operations
import { appendFile } from 'fs/promises';

const PATSNAP_CLIENT_ID = process.env.PATSNAP_CLIENT_ID;
const PATSNAP_CLIENT_SECRET = process.env.PATSNAP_CLIENT_SECRET;
const PATSNAP_API_BASE_URL = 'https://connect.patsnap.com'; // Define base URL as constant
const LOG_FILE_PATH = 'patsnap_token_response.log'; // Define log file path

// Consider adding token caching with expiry
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60; // Fetch new token 60 seconds before expiry

async function getAccessToken(): Promise<string> {
  const now = Date.now() / 1000; // Current time in seconds

  if (cachedToken && cachedToken.expiresAt > now + TOKEN_EXPIRY_BUFFER_SECONDS) {
      console.log('Using cached access token.'); // Optional: Log cache usage
      return cachedToken.token;
  }
  console.log('Fetching new access token...'); // Optional: Log token fetch

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
  // Use async file append
  try {
    // Use fs.promises.appendFile
    await appendFile(LOG_FILE_PATH, `\nPatSnap token response at ${new Date().toISOString()}: ${JSON.stringify(json, null, 2)}\n`);
  } catch (err) {
      console.error("Failed to write to log file:", err);
      // Decide if this should be a critical error or just logged
  }

  // More robust token parsing and expiry handling
  const token = json.access_token || json.token || (json.data && json.data.token);
  const expiresIn = json.expires_in; // Assuming the API returns expires_in in seconds

  if (!token || typeof token !== 'string') { // Add type check for token
    throw new McpError(500, 'Failed to parse access token from response');
  }

  if (typeof expiresIn === 'number' && expiresIn > 0) {
      cachedToken = {
          token: token,
          expiresAt: now + expiresIn
      };
      console.log(`Token cached. Expires in ${expiresIn} seconds.`); // Optional log
  } else {
      console.warn('Token expiry information (expires_in) not found or invalid in response. Token caching disabled.');
      cachedToken = null; // Invalidate cache if expiry is unknown
  }

  return token;
}

// Helper function to build URLSearchParams, avoiding repetition
function buildCommonSearchParams(args: Record<string, string | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key in args) {
        // Ensure the property belongs to the object itself and is not undefined
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
    const token = await getAccessToken(); // Will use cached token if available and valid
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
        // Consider mapping specific PatSnap error codes (e.g., 67200003 for expired token) to MCP errors
        if (response.status === 401 || response.status === 403) {
             // Invalidate cache on auth errors
             cachedToken = null;
             console.log('Authentication error detected, clearing token cache.');
        }
        throw new McpError(response.status, `Failed to ${errorContext}: ${text}`);
    }

    const json = await response.json();
    // Optional: Add more sophisticated response validation if needed
    return {
        content: [
            {
                type: 'text',
                // Return the raw JSON response as text, formatted for readability
                text: JSON.stringify(json, null, 2)
            }
        ]
    };
}

// Define argument types for better readability and potential future validation
type BasePatentArgs = { keywords?: string; ipc?: string; apply_start_time?: string; apply_end_time?: string; public_start_time?: string; public_end_time?: string; authority?: string };
type LangPatentArgs = BasePatentArgs & { lang?: string };


// --- Tool Implementation Functions ---

async function getPatentTrends(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  return callPatsnapApi('patent-trends', params, 'get patent trends');
}

async function getWordCloud(args: LangPatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('word-cloud', params, 'get word cloud');
}

async function getWheelOfInnovation(args: LangPatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('wheel-of-innovation', params, 'get wheel of innovation');
}

async function getTopAuthoritiesOfOrigin(args: LangPatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('priority-country', params, 'get top authorities of origin');
}

async function getMostCitedPatents(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  return callPatsnapApi('most-cited', params, 'get most cited patents');
}

async function getTopInventors(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  // No 'lang' parameter for this endpoint
  return callPatsnapApi('inventor-ranking', params, 'get top inventors');
}

async function getTopAssignees(args: LangPatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  if (!args.lang) { // Add default lang if not provided
      params.append('lang', 'en');
  }
  return callPatsnapApi('applicant-ranking', params, 'get top assignees');
}

// +++ NEW FUNCTION +++
// [A008] Simple Legal Status
async function getSimpleLegalStatus(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  // No 'lang' parameter for this endpoint
  return callPatsnapApi('simple-legal-status', params, 'get simple legal status');
}
// +++ END NEW FUNCTION +++


const server = new Server(
  {
    name: 'patsnap-mcp',
    version: '0.1.0' // Consider incrementing version with new features
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// --- Schemas for Tool Inputs (Centralized for clarity) ---
const basePatentInputSchema = {
    type: 'object' as const, // Use 'as const' for stricter type checking
    properties: {
        keywords: { type: 'string', description: 'Keywords to search within patent title and abstract/summary. Supports AND, OR, NOT logic. Example: "mobile phone AND (screen OR battery)"' },
        ipc: { type: 'string', description: 'Patent IPC classification code. Used to specify a particular technology field.' },
        apply_start_time: { type: 'string', description: 'Patent application start year (yyyy format). Filters by application filing date.' },
        apply_end_time: { type: 'string', description: 'Patent application end year (yyyy format). Filters by application filing date.' },
        public_start_time: { type: 'string', description: 'Patent publication start year (yyyy format). Filters by publication date.' },
        public_end_time: { type: 'string', description: 'Patent publication end year (yyyy format). Filters by publication date.' },
        authority: { type: 'string', description: 'Patent authority code (e.g., CN, US, EP, JP). Filters by patent office. Use OR for multiple, e.g., "US OR EP".' }
    },
    // Add a note about requiring keywords or IPC for most tools
    description: "Requires either 'keywords' or 'ipc' to be specified for a meaningful search."
};

const langPatentInputSchema = {
    ...basePatentInputSchema,
    properties: {
        ...basePatentInputSchema.properties,
        lang: { type: 'string', description: 'Language setting. Default is "en" (English). Choose "cn" (Chinese) or "en".' }
    }
};

const langRequiredPatentInputSchema = {
    ...langPatentInputSchema,
    required: ['lang']
};


server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // --- Tool Definitions using Schemas ---
      {
        name: 'get_patent_trends',
        description: 'Analyze annual application and issued trends for patents. Understand the trends of patents related to specific technology fields or keywords. Either keywords or IPC classification must be specified.',
        inputSchema: basePatentInputSchema
      },
      {
        name: 'get_word_cloud',
        description: 'Obtain a snapshot of frequently occurring keywords/phrases from the most recent 5,000 published patents. Identify common terms for refining searches. Returns up to 100 keywords. Either keywords or IPC classification must be specified.',
        inputSchema: langPatentInputSchema
      },
      {
        name: 'get_wheel_of_innovation',
        description: 'Provides a two-tiered hierarchical view of keywords/phrases in a technology space. Identify common terms and their associations. Based on the most recent 5,000 publications. Either keywords or IPC classification must be specified.',
        inputSchema: langPatentInputSchema
      },
      {
        name: 'get_most_cited_patents',
        description: 'View the top patents cited most frequently by others, indicating influential or core technology. Returns at most Top 10 patents. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        inputSchema: basePatentInputSchema
      },
      {
        name: 'get_top_authorities_of_origin',
        description: 'Returns the top authorities (priority countries) of origin for patents matching the criteria. Analyze main sources of priority filings. Either keywords or IPC classification must be specified.',
        inputSchema: langPatentInputSchema
      },
      {
        name: 'get_top_inventors',
        description: 'Shows the top inventors in the technology field. Evaluate top performers or identify potential recruits. Returns up to the top 10 inventors. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        inputSchema: basePatentInputSchema
      },
      {
        name: 'get_top_assignees',
        description: 'Shows the top companies (assignees) with the largest patent portfolios. Identify largest players and competitive threats. Returns up to the top 10 assignees. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        // Using langRequired schema as API docs state lang is required (though it defaults)
        inputSchema: langRequiredPatentInputSchema
      },
      // +++ NEW TOOL DEFINITION +++
      {
        name: 'get_simple_legal_status',
        description: 'Provides a breakdown of the simple legal status (e.g., Active, Inactive, Pending) for patents in the technology field. Understand the proportion of patents currently in effect. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        inputSchema: basePatentInputSchema // Uses base schema as 'lang' is not applicable
      }
      // +++ END NEW TOOL DEFINITION +++
    ]
  };
});

// Use a map for cleaner tool dispatching
const toolImplementations: Record<string, (args: any) => Promise<ServerResult>> = {
    'get_patent_trends': getPatentTrends,
    'get_word_cloud': getWordCloud,
    'get_wheel_of_innovation': getWheelOfInnovation,
    'get_top_authorities_of_origin': getTopAuthoritiesOfOrigin,
    'get_most_cited_patents': getMostCitedPatents,
    'get_top_inventors': getTopInventors,
    'get_top_assignees': getTopAssignees,
    'get_simple_legal_status': getSimpleLegalStatus, // Add new tool here
};

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  // Basic validation of request structure
  if (!req || typeof req !== 'object' || !req.params || typeof req.params !== 'object') {
       throw new McpError(400, 'Invalid CallToolRequest format.');
  }

  const { name, arguments: args } = req.params;

  if (typeof name !== 'string' || !name) {
       throw new McpError(400, 'Tool name is missing or invalid.');
  }
   // It's generally better to let the tool implementation handle default/missing args
   const toolArgs = typeof args === 'object' && args !== null ? args : {};

  const implementation = toolImplementations[name];

  if (implementation) {
      // The specific argument types (BasePatentArgs, LangPatentArgs) are implicitly
      // handled by the function signatures now. The `toolArgs` here is appropriately `any` or `object`.
      try {
          return await implementation(toolArgs);
      } catch (error) {
          // Catch errors from implementation (including McpError from callPatsnapApi)
          if (error instanceof McpError) {
              // Re-throw McpError to be handled by the SDK/caller
              throw error;
          } else if (error instanceof Error) {
              // Log unexpected errors and wrap in McpError
              console.error(`Unexpected error calling tool ${name}:`, error.message, error.stack);
              throw new McpError(500, `Internal server error executing tool ${name}: ${error.message}`);
          } else {
              // Handle non-Error throws
              console.error(`Unexpected non-error thrown calling tool ${name}:`, error);
              throw new McpError(500, `Internal server error executing tool ${name}`);
          }
      }
  } else {
    console.error(`Unknown tool called: ${name}`); // Log unknown tool calls
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

server.connect(new StdioServerTransport());
console.log("PatSnap MCP Server started and connected via Stdio."); // Add a startup message
