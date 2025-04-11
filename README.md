# PatSnap MCP Server

This MCP server is designed to collect patent-related information from PatSnap's API for trend analysis and reporting. It is not intended for individual patent investigations.

## Features

This server provides the following tools for interacting with the PatSnap Insights API:

- **get_patent_trends**: Analyze annual application and issued trends for patents. Understand the trends of patents related to specific technology fields or keywords. Either keywords or IPC classification must be specified.
- **get_word_cloud**: Obtain a snapshot of frequently occurring keywords/phrases from the most recent 5,000 published patents. Identify common terms for refining searches. Returns up to 100 keywords. Either keywords or IPC classification must be specified.
- **get_wheel_of_innovation**: Provides a two-tiered hierarchical view of keywords/phrases in a technology space. Identify common terms and their associations. Based on the most recent 5,000 publications. Either keywords or IPC classification must be specified.
- **get_most_cited_patents**: View the top patents cited most frequently by others, indicating influential or core technology. Returns at most Top 10 patents. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.
- **get_top_authorities_of_origin**: Returns the top authorities (priority countries) of origin for patents matching the criteria. Analyze main sources of priority filings. Either keywords or IPC classification must be specified.
- **get_top_inventors**: Shows the top inventors in the technology field. Evaluate top performers or identify potential recruits. Returns up to the top 10 inventors. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.
- **get_top_assignees**: Shows the top companies (assignees) with the largest patent portfolios. Identify largest players and competitive threats. Returns up to the top 10 assignees. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.
- **get_simple_legal_status**: Provides a breakdown of the simple legal status (e.g., Active, Inactive, Pending) for patents in the technology field. Understand the proportion of patents currently in effect. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.
- **get_most_litigated_patents**: Identify the patents involved in the most litigation cases, indicating potential risk in a technology space. Returns the Top 10 patents by litigation count. Note: Search must contain either keywords or IPC. If both are provided, IPC is prioritized.

## Setup

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Build the project using `npm run build`.
4. Run the server using `npm start`.

## Usage

- Use the provided tools to interact with PatSnap's API.
- Ensure you have valid PatSnap API credentials (Client ID and Secret) set as environment variables (`PATSNAP_CLIENT_ID`, `PATSNAP_CLIENT_SECRET`).

## Configuration for MCP Host

To integrate this MCP server with your MCP Host, add the following configuration to your `cline_mcp_settings.json` file (path may vary based on your host setup):

```json
{
  "mcpServers": {
    "@kunihiros/patsnap-mcp": {
      "command": "npx",
      "args": ["@kunihiros/patsnap-mcp"],
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

Ensure you replace `your_patsnap_client_id_here` and `your_patsnap_client_secret_here` with your actual PatSnap API credentials. This configuration allows the MCP Host to invoke the server using `npx @kunihiros/patsnap-mcp`.

## License

This project is licensed under the MIT License.
