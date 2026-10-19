# Cline PreToolUse hook (Windows). Enforces policy.yaml where Cline allows it:
#   kill switch, domain restriction, action budget.
# Cline passes JSON on stdin; we reply with single-line JSON on stdout. Only stdout is parsed.

$ErrorActionPreference = 'Stop'

$allowedOrigins = @('http://localhost:3000')
$maxActions = 50   # must match action_budget.max_actions in policy.yaml
$countedActions = @('click', 'type')   # browser_action sub-actions that count

function Deny([string]$msg) {
    Write-Output (@{ cancel = $true; errorMessage = $msg } | ConvertTo-Json -Compress)
    exit 0
}

try {
    $in = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $root = $in.workspaceRoots[0]
    $tool = $in.preToolUse.tool
    $p = $in.preToolUse.parameters

    # 5. Kill switch: file in workspace root, or AGENT_KILL=1
    if ((Test-Path (Join-Path $root 'KILL')) -or $env:AGENT_KILL -eq '1') {
        Deny 'Kill switch active (KILL file or AGENT_KILL=1). Run stopped by operator.'
    }

    if ($tool -eq 'browser_action') {
        $action = $p.action

        # 4. Domain restriction: any URL-bearing browser action must be an allowed origin
        if ($p.url) {
            $ok = $false
            foreach ($o in $allowedOrigins) {
                if ($p.url -eq $o -or $p.url.StartsWith("$o/") -or $p.url.StartsWith("$o?")) { $ok = $true }
            }
            if (-not $ok) { Deny "Blocked: $($p.url) is outside allowed origins ($($allowedOrigins -join ', '))." }
        }

        # 3. Action budget: count clicks + typing per task, cancel when exceeded
        if ($countedActions -contains $action) {
            $dir = Join-Path $PSScriptRoot '.state'
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            $file = Join-Path $dir "$($in.taskId).count"
            $n = 0
            if (Test-Path $file) { $n = [int](Get-Content $file -Raw) }
            $n++
            Set-Content -Path $file -Value $n
            if ($n -gt $maxActions) {
                Deny "Action budget of $maxActions exceeded. Operator approval needed: delete $file to continue."
            }
        }
    }

    # Allow
    Write-Output '{}'
} catch {
    # Fail closed: a broken guardrail must not silently allow actions.
    [Console]::Error.WriteLine("PreToolUse hook error: $_")
    Deny "Guardrail hook failed ($($_.Exception.Message)); blocking for safety."
}
