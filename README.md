# PatSnap MCP Server

This MCP server is designed to collect patent-related information from PatSnap's API for trend analysis and reporting. It is not intended for individual patent investigations. The server is based on the stdio protocol and can be integrated with other MCP tools.

## Features

- **get_patent_trends**: Analyze annual application and issued trends for patents using PatSnap's Application and Issued Trend API. Supports filtering by keywords, IPC classification, application/publication dates, and patent authority.
- **get_word_cloud**: Get a snapshot view of keywords and phrases in the technology space from the most recent 5,000 publications using PatSnap's Word Cloud API. Returns up to the top 100 keywords. Supports filtering by keywords or IPC.
- **get_wheel_of_innovation**: Provides a two-tiered view of keywords and phrases in a technology space, categorized into a hierarchy using PatSnap's Wheel of Innovation API. Useful for identifying common terms and their associations. Based on the most recent 5,000 publications. Supports filtering by keywords or IPC.
- Additional tools for patent technology trend investigation are planned, focusing on features classified under Technology Key Report.

## Setup

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Run the server using `npm start`.

## Usage

- Use the provided tools to interact with PatSnap's API.
- Ensure you have valid API credentials for authentication.

## Configuration for MCP Host

To integrate this MCP server with your MCP Host, add the following configuration to your `cline_mcp_settings.json` file located at `/home/kunihiros/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "patsnap-mcp": {
      "command": "npx",
      "args": ["-y", "patsnap-mcp"],
      "env": {
        "PATSNAP_CLIENT_ID": "your_patsnap_client_id_here",
        "PATSNAP_CLIENT_SECRET": "your_patsnap_client_secret_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Ensure you replace `your_patsnap_client_id_here` and `your_patsnap_client_secret_here` with your actual PatSnap API credentials. This configuration will enable the PatSnap MCP Server to run with the necessary credentials using `npx` for invocation.

## License

This project is licensed under the MIT License.
