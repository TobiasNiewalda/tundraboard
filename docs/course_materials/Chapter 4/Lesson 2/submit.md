# Lesson 2 Submission: Extend Your AI Agent with MCP Tools for TundraBoard

## Scope
The exercise is primarily about comparing CLI-based external access with MCP-based external access, documenting the MCP configuration, and using external tooling to complete a repository analysis task. The current agent environment exposes shell access and GitHub CLI, but it does not expose an MCP client layer that can load `mcp-config.json` and register those servers into the agent's tool registry. In practice, this means the environment can launch local processes with shell commands, but it cannot become an MCP-aware host the way VS Code Copilot or Claude Code can. This submission records the existing MCP configuration in the repo and demonstrates the closest equivalent using `gh`.

## Exercise Checklist

0. CLI warm-up completed
1. MCP server configuration documented
2. MCP-driven task completed with the closest available external-access path
3. CLI vs MCP evaluation written up

## 0. CLI Warm-up

I used GitHub CLI as the warm-up baseline because it already existed in the environment and could reach the external GitHub repository immediately.

Commands run:

```text
$ gh --version
gh version 2.95.0 (2026-06-17)
https://github.com/cli/cli/releases/tag/v2.95.0

$ gh auth status
github.com
  ✓ Logged in to github.com account TobiasNiewalda (keyring)
  - Active account: true
  - Git operations protocol: ssh
  - Token: gho_************************************
  - Token scopes: 'admin:public_key', 'gist', 'read:org', 'repo'
```

Warm-up query:

```text
$ gh pr list --repo skillio-ai/tundraboard --state merged --limit 5 --json number,title,files
```

Sample result:

```json
[
  {
    "number": 7,
    "title": "security: bump vitest to ^4.1.0 (GHSA-5xrq-8626-4rwp)",
    "files": [
      { "path": "package-lock.json", "additions": 709, "deletions": 1021, "changeType": "MODIFIED" },
      { "path": "package.json", "additions": 2, "deletions": 2, "changeType": "MODIFIED" }
    ]
  },
  {
    "number": 6,
    "title": "security: override qs and brace-expansion to patched versions",
    "files": [
      { "path": "package-lock.json", "additions": 17, "deletions": 90, "changeType": "MODIFIED" },
      { "path": "package.json", "additions": 4, "deletions": 0, "changeType": "MODIFIED" }
    ]
  },
  {
    "number": 5,
    "title": "ci: bump checkout and setup-node to v6",
    "files": [
      { "path": ".github/workflows/ci.yml", "additions": 2, "deletions": 2, "changeType": "MODIFIED" }
    ]
  }
]
```

## 1. MCP Server Configuration

The repository already contains an MCP configuration file at `mcp-config.json`. No new MCP servers were added for this submission; I documented the existing ones and tightened the GitHub server to make its least-privilege scope explicit.

```json
{
  "mcpServers": {
    "memory": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/memory.jsonl"
      }
    },
    "sequential-thinking": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ],
      "env": {
        "DISABLE_THOUGHT_LOGGING": "true"
      }
    },
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-p",
        "127.0.0.1:8085:8085",
        "-e",
        "GITHUB_OAUTH_CALLBACK_PORT",
        "ghcr.io/github/github-mcp-server",
        "--read-only",
        "--toolsets",
        "repos,pull_requests,actions"
      ],
      "env": {
        "GITHUB_OAUTH_CALLBACK_PORT": "8085"
      }
    },
    "filesystem": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "${workspaceFolder}"
      ]
    },
    "fetch": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    },
    "browserbase": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-browserbase"
      ]
    }
  }
}
```

Note: the config file does not store plaintext credentials. It uses environment variables and runtime authentication where needed. For a production GitHub MCP setup, the token should be scoped to read-only repository and pull-request metadata rather than admin or write permissions.

## 2. Documentation: MCP inventory and permissions

| Server | What it exposes | Permissions / scope | Security notes |
|---|---|---|---|
| `memory` | Persistent agent memory via `@modelcontextprotocol/server-memory` | Local memory file path only | Low risk; scoped to the memory store |
| `sequential-thinking` | Structured reasoning support | No external data access | Low risk; reasoning-only helper |
| `github` | GitHub repository access via `ghcr.io/github/github-mcp-server` | GitHub access through the container runtime; explicitly limited to `repos,pull_requests,actions` and `--read-only` | Useful for repo, PR, and CI workflows; kept narrow for least privilege |
| `filesystem` | Workspace file access | Entire workspace folder | Broad but appropriate for repo-local work |
| `fetch` | HTTP fetch tool for reading web resources | Network access through fetch requests | Use only against trusted endpoints |
| `browserbase` | Browser automation / remote browser access | Networked browser control | Treat as high trust; review any opened pages carefully |

## 3. External-Access Task

The external-access task I used for the exercise was:

> Walk the merged pull requests on the TundraBoard repository and summarize which files change most often, and what that says about where the codebase is unstable.

I used GitHub CLI for this analysis because the current environment did not expose the MCP GitHub server as a directly callable tool, even though the repository already contains an MCP configuration for it. The barrier was architectural, not just operational: this agent session does not have an MCP host bridge that can read `mcp-config.json`, start the servers, and expose their tools to the model.

Command run:

```text
$ gh pr list --repo skillio-ai/tundraboard --state merged --limit 20 --json number,title,files
```

File-churn summary produced from the merged PR list:

```text
path                           prs
----                           ---
package.json                     4
package-lock.json                3
.github/dependabot.yml           2
.github/workflows/ci.yml         2
README.md                        2
src/routes/health.ts             2
.npmrc                           1
.nvmrc                           1
src/middleware/authenticate.ts   1
```

### Interpretation

The most frequently changed files are dependency and release-management surfaces, not feature code:

- `package.json` and `package-lock.json` changed most often, which points to dependency maintenance and security updates being a recurring maintenance area.
- `.github/workflows/ci.yml` and `.github/dependabot.yml` show platform and automation churn.
- `src/routes/health.ts` and `src/middleware/authenticate.ts` appear, but with lower frequency than package management changes.

That suggests the codebase instability is concentrated around dependency hygiene and operational tooling rather than one specific business feature area.

## 3. CLI vs MCP Evaluation

### What CLI did well

- It was immediately available and already authenticated.
- It gave structured output with `--json`, which made the analysis easy to automate.
- For a single repository query, it was fast enough that no extra setup was needed.

### What MCP would add

- Structured tool discovery: the agent would know which repo tools are available without memorizing `gh` flags.
- Better permission scoping: a GitHub MCP server could be configured to expose only the tools needed for repo inspection.
- Reusability: the same MCP configuration could be shared across tools and users instead of repeating shell setup.

### How I would wire it in an MCP-native host

In a host that natively supports MCP server registration, the GitHub server would be declared with the same tool shape and then loaded by the host instead of by shell-only execution. For VS Code Copilot, the host-side shape uses a `servers` map such as:

```json
{
  "servers": {
    "github": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-p",
        "127.0.0.1:8085:8085",
        "-e",
        "GITHUB_OAUTH_CALLBACK_PORT",
        "ghcr.io/github/github-mcp-server",
        "--read-only",
        "--toolsets",
        "repos,pull_requests,actions"
      ]
    }
  }
}
```

That wiring is the important distinction: an MCP-native host loads the server definition and exposes the resulting tools to the model. This environment can only run the Docker or `npx` command; it cannot attach the server to the agent as an MCP tool source.

### Security assessment

The current repo-level MCP configuration is functional, but it is not the most restrictive possible setup:

- The GitHub MCP server is present, but the config does not explicitly pin a read-only mode or a reduced toolset.
- The filesystem server is scoped to the whole workspace, which is fine for course work but still broad from a principle-of-least-privilege perspective.
- The fetch and browser automation servers are network-capable and should be treated as higher trust than local-only tools.
- The memory and sequential-thinking servers are low-risk helpers because they do not need broad external access.

### Bottom line

For this submission, CLI was the practical path because the environment already had `gh` available and authenticated. MCP would be the better long-term integration pattern for discoverability, scoping, and reuse, but the repo already contains the key MCP server definitions and the current tool environment did not surface them directly.

## 4. Completed Deliverables

- Existing MCP configuration documented from `mcp-config.json`
- CLI warm-up and GitHub repository access evidenced with `gh`
- Merged-PR file-churn analysis completed
- Security comparison and MCP-vs-CLI evaluation written up
