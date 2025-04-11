import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
// fs is no longer needed directly as appendFile is imported from fs/promises
// import fs from 'fs';
import { appendFile } from 'fs/promises';
import path from 'path'; // Import path for potential future use (e.g., log directory)
import { fileURLToPath } from 'url'; // For getting __dirname in ES modules if needed

// Determine log file path relative to the current file if needed
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const LOG_FILE_PATH = path.join(__dirname, '..', 'patsnap_token_response.log'); // Example: Place log file one level up

const PATSNAP_CLIENT_ID = process.env.PATSNAP_CLIENT_ID;
const PATSNAP_CLIENT_SECRET = process.env.PATSNAP_CLIENT_SECRET;
const PATSNAP_API_BASE_URL = 'https://connect.patsnap.com'; // Define base URL as constant
const LOG_FILE_PATH = 'patsnap_token_response.log'; // Define log file path (relative to execution dir)

// Token Caching
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
    // Use a more specific error message
    throw new McpError(500, 'Server configuration error: Missing PatSnap API credentials.');
  }

  let response: Response;
  try {
      response = await fetch(`${PATSNAP_API_BASE_URL}/oauth/token`, { // Use base URL constant
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${PATSNAP_CLIENT_ID}:${PATSNAP_CLIENT_SECRET}`).toString('base64')
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials'
        })
      });
  } catch (error) {
      console.error("Network error fetching access token:", error);
      throw new McpError(503, `Network error connecting to PatSnap auth service: ${error instanceof Error ? error.message : String(error)}`);
  }


  if (!response.ok) {
    let errorText = `Status code ${response.status}`;
    try {
        errorText = await response.text();
    } catch (e) {
        console.error("Failed to read error response body:", e);
    }
    // Clear cache on failure to get token
    cachedToken = null;
    throw new McpError(response.status, `Failed to get PatSnap access token: ${errorText}`);
  }

  let json: any;
  try {
      json = await response.json();
  } catch (error) {
      console.error("Error parsing token response JSON:", error);
      cachedToken = null;
      throw new McpError(500, `Failed to parse PatSnap access token response: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Log token response (consider logging only on success or specific levels)
  try {
    await appendFile(LOG_FILE_PATH, `\nPatSnap token response at ${new Date().toISOString()}: ${JSON.stringify(json, null, 2)}\n`);
  } catch (err) {
      // Log failure to write, but don't block token retrieval
      console.error("Failed to write token response to log file:", err);
  }

  // More robust token parsing and expiry handling
  // Check common variations of token field names
  const token = json.access_token || json.token || (json.data && json.data.token);
  // Check common variations of expiry field names (e.g., expires_in, expiresIn)
  const expiresIn = json.expires_in || json.expiresIn;

  if (!token || typeof token !== 'string') { // Add type check for token
    cachedToken = null; // Ensure cache is clear if token is invalid
    throw new McpError(500, 'Failed to parse access token from PatSnap response structure.');
  }

  if (typeof expiresIn === 'number' && expiresIn > 0) {
      cachedToken = {
          token: token,
          expiresAt: now + expiresIn
      };
      console.log(`Token cached. Expires in ${expiresIn} seconds.`); // Optional log
  } else {
      console.warn('Token expiry information (e.g., expires_in) not found or invalid in response. Token caching disabled.');
      cachedToken = null; // Invalidate cache if expiry is unknown
  }

  return token;
}

// Helper function to build URLSearchParams, avoiding repetition
function buildCommonSearchParams(args: Record<string, string | number | boolean | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key in args) {
        // Ensure the property belongs to the object itself and is not undefined or null
        if (Object.prototype.hasOwnProperty.call(args, key) && args[key] != null) {
            // Convert boolean/number to string if necessary for URLSearchParams
            params.append(key, String(args[key]));
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
    console.log(`Calling PatSnap API: ${url}`); // Log the request URL (consider using a proper logger)

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: {
                // 'Content-Type': 'application/json', // Typically not needed for GET
                'Authorization': `Bearer ${token}`
            }
            // Consider adding a timeout
            // signal: AbortSignal.timeout(15000) // e.g., 15 seconds timeout
        });
    } catch (error) {
        console.error(`Network error calling PatSnap API endpoint ${endpoint}:`, error);
        throw new McpError(503, `Network error connecting to PatSnap API (${endpoint}): ${error instanceof Error ? error.message : String(error)}`);
    }


    if (!response.ok) {
        let errorText = `Status code ${response.status}`;
        try {
            errorText = await response.text();
        } catch (e) {
            console.error("Failed to read error response body:", e);
        }
        console.error(`API Error (${response.status}) for ${endpoint}: ${errorText}`); // Log error details
        // Invalidate cache on auth errors (401 Unauthorized, 403 Forbidden)
        if (response.status === 401 || response.status === 403) {
             cachedToken = null;
             console.log('Authentication error detected, clearing token cache.');
        }
        // Map common PatSnap error codes to potentially more user-friendly messages if desired
        // Example: if (errorText.includes("67200002")) { throw new McpError(429, "PatSnap API quota exceeded."); }
        throw new McpError(response.status, `Failed to ${errorContext}: ${errorText}`);
    }

    let json: any;
    try {
        json = await response.json();
    } catch (error) {
        console.error(`Error parsing JSON response from ${endpoint}:`, error);
        throw new McpError(500, `Failed to parse JSON response from PatSnap API (${endpoint}): ${error instanceof Error ? error.message : String(error)}`);
    }

    // Basic check for PatSnap's own error structure within a 200 OK response
    if (json && json.status === false && json.error_code !== 0) {
        console.error(`PatSnap API returned error within successful response for ${endpoint}: Code ${json.error_code}, Msg: ${json.error_msg}`);
        // You might want to map these internal errors to McpError as well
        throw new McpError(400, `PatSnap API Error (${json.error_code}): ${json.error_msg || 'Unknown error'}`);
    }

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

async function getSimpleLegalStatus(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  // No 'lang' parameter for this endpoint
  return callPatsnapApi('simple-legal-status', params, 'get simple legal status');
}

// +++ NEW FUNCTION +++
// [A009] Most Litigated Patents
async function getMostLitigatedPatents(args: BasePatentArgs): Promise<ServerResult> {
  const params = buildCommonSearchParams(args);
  // No 'lang' parameter for this endpoint
  return callPatsnapApi('most-asserted', params, 'get most litigated patents');
}
// +++ END NEW FUNCTION +++


const server = new Server(
  {
    name: 'patsnap-mcp',
    version: '0.1.1' // Incremented version
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
    description: "Requires either 'keywords' or 'ipc' to be specified for a meaningful search. If both are provided, IPC is prioritized by the API."
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
        inputSchema: langRequiredPatentInputSchema
      },
      {
        name: 'get_simple_legal_status',
        description: 'Provides a breakdown of the simple legal status (e.g., Active, Inactive, Pending) for patents in the technology field. Understand the proportion of patents currently in effect. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        inputSchema: basePatentInputSchema
      },
      // +++ NEW TOOL DEFINITION +++
      {
        name: 'get_most_litigated_patents',
        description: 'Identify the patents involved in the most litigation cases, indicating potential risk in a technology space. Returns the Top 10 patents by litigation count. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.',
        inputSchema: basePatentInputSchema // Uses base schema as 'lang' is not applicable
      }
      // +++ END NEW TOOL DEFINITION +++
    ]
  };
});

const toolImplementations: Record<string, (args: any) => Promise<ServerResult>> = {
    'get_patent_trends': getPatentTrends,
    'get_word_cloud': getWordCloud,
    'get_wheel_of_innovation': getWheelOfInnovation,
    'get_top_authorities_of_origin': getTopAuthoritiesOfOrigin,
    'get_most_cited_patents': getMostCitedPatents,
    'get_top_inventors': getTopInventors,
    'get_top_assignees': getTopAssignees,
    'get_simple_legal_status': getSimpleLegalStatus,
    'get_most_litigated_patents': getMostLitigatedPatents
};

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  // Basic validation of request structure
  if (!req || typeof req !== 'object' || !req.params || typeof req.params !== 'object') {
       throw new McpError(400, 'Invalid CallToolRequest format: Missing or invalid "params" object.');
  }

  const { name, arguments: args } = req.params;

  if (typeof name !== 'string' || !name) {
       throw new McpError(400, 'Invalid CallToolRequest format: Tool "name" is missing or invalid.');
  }
   // Ensure args is an object, defaulting to empty if missing/null
   const toolArgs = typeof args === 'object' && args !== null ? args : {};

  const implementation = toolImplementations[name];

  if (implementation) {
      // The specific argument types (BasePatentArgs, LangPatentArgs) are implicitly
      // handled by the function signatures now. The `toolArgs` here is appropriately `any` or `object`.
      try {
          // Validate required args (keywords or ipc) before calling implementation if desired
          // Although the API handles this, early validation can provide clearer errors.
          // if (!toolArgs.keywords && !toolArgs.ipc) {
          //     throw new McpError(400, `Tool '${name}' requires either 'keywords' or 'ipc' argument.`);
          // }
          console.log(`Executing tool: ${name} with args:`, JSON.stringify(toolArgs)); // Log execution
          return await implementation(toolArgs);
      } catch (error) {
          // Catch errors from implementation (including McpError from callPatsnapApi)
          if (error instanceof McpError) {
              // Log McpErrors before re-throwing for better server-side visibility
              console.error(`McpError executing tool ${name}: Code ${error.code}, Message: ${error.message}`);
              throw error;
          } else if (error instanceof Error) {
              // Log unexpected errors and wrap in McpError
              console.error(`Unexpected error calling tool ${name}:`, error.message, error.stack);
              throw new McpError(500, `Internal server error executing tool ${name}: ${error.message}`);
          } else {
              // Handle non-Error throws
              console.error(`Unexpected non-error thrown calling tool ${name}:`, error);
              throw new McpError(500, `Internal server error executing tool ${name}: Unexpected throw type.`);
          }
      }
  } else {
    console.error(`Unknown tool called: ${name}`); // Log unknown tool calls
    throw new McpError(404, `Unknown tool: ${name}`);
  }
});

// Graceful shutdown handling (optional but recommended)
const transport = new StdioServerTransport();
server.connect(transport);
console.log(`PatSnap MCP Server v0.1.1 started and connected via Stdio.`); // Add version to startup message

function shutdown(signal: string) {
    console.log(`Received ${signal}. Shutting down PatSnap MCP server...`);
    // Perform any cleanup here (e.g., close database connections, stop timers)
    transport.close(); // Close the transport
    console.log("Server shut down gracefully.");
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // kill/system shutdown
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
    // Consider whether to attempt graceful shutdown or exit immediately
    process.exit(1); // Exit with error code
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider whether to attempt graceful shutdown or exit immediately
    process.exit(1); // Exit with error code
});
