# Claude Code PreToolUse hook (Windows). Enforces policy.yaml for MCP browser tools:
#   kill switch (all tools), domain restriction, action budget, human gate.
# Claude passes JSON on stdin; we reply with a permissionDecision (deny / ask) or nothing (allow).
# NOTE: constants below duplicate policy.yaml -- keep them in sync.

$ErrorActionPreference = 'Stop'

$allowedOrigins = @('http://localhost:3000')
$maxActions = 50
$browserTool = 'mcp__.*(chrome-devtools|playwright).*'
$countedTools = 'click|fill|fill_form|type_text|press_key|drag'   # clicks + keystrokes
$urlTools = 'navigate_page|new_page'
$askTools = 'evaluate_script'   # arbitrary JS can bypass click/URL checks, so confirm each time

function Decide([string]$decision, [string]$reason) {
    Write-Output (@{
        hookSpecificOutput = @{
            hookEventName            = 'PreToolUse'
            permissionDecision       = $decision
            permissionDecisionReason = $reason
        }
    } | ConvertTo-Json -Compress -Depth 4)
    exit 0
}

try {
    $in = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $root = if ($in.cwd) { $in.cwd } else { (Get-Location).Path }
    $tool = [string]$in.tool_name
    $args_ = $in.tool_input

    # 5. Kill switch: applies to every tool
    if ((Test-Path (Join-Path $root 'KILL')) -or $env:AGENT_KILL -eq '1') {
        Decide 'deny' 'Kill switch active (KILL file or AGENT_KILL=1). Run stopped by operator.'
    }

    if ($tool -match $browserTool) {
        $short = $tool -replace '^mcp__.*__', ''

        # 4. Domain restriction
        if ($short -match "^($urlTools)$" -and $args_.url) {
            $ok = $false
            foreach ($o in $allowedOrigins) {
                if ($args_.url -eq $o -or $args_.url.StartsWith("$o/") -or $args_.url.StartsWith("$o?")) { $ok = $true }
            }
            if (-not $ok) { Decide 'deny' "Blocked: $($args_.url) is outside allowed origins ($($allowedOrigins -join ', '))." }
        }

        # 6. Human gate: confirm arbitrary script execution
        if ($short -match "^($askTools)$") {
            Decide 'ask' "Operator confirmation required for $short (can bypass click and URL guardrails)."
        }

        # 3. Action budget: count per session, ask for approval once exceeded
        if ($short -match "^($countedTools)$") {
            $dir = Join-Path $PSScriptRoot '.state'
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            $file = Join-Path $dir "$($in.session_id).count"
            $n = 0
            if (Test-Path $file) { $n = [int](Get-Content $file -Raw) }
            $n++
            Set-Content -Path $file -Value $n
            if ($n -gt $maxActions) {
                Decide 'ask' "Action budget of $maxActions exceeded (action $n). Approve to continue."
            }
        }
    }
    # Allow: no output
    exit 0
} catch {
    # Fail closed: a broken guardrail must not silently allow actions.
    [Console]::Error.WriteLine("guard.ps1 error: $_")
    Decide 'deny' "Guardrail hook failed ($($_.Exception.Message)); blocking for safety."
}
