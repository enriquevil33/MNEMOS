param(
    [string]$ComposeFile = "docker-compose.yml",
    [string]$ContainerName = "dev-llamacpp-1",
    [int]$TimeoutSeconds = 120
)

Write-Host "[llamacpp] Waiting up to ${TimeoutSeconds}s for health..."

$healthy = $false
for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
    Start-Sleep -Seconds 1
    try {
        $state = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
        if ($state -eq 'healthy') {
            Write-Host "[llamacpp] Healthy!"
            $healthy = $true
            break
        }
        if ($state -eq 'unhealthy') {
            Write-Host "[llamacpp] Unhealthy!" -ForegroundColor Yellow
            break
        }
    } catch {}
}

if (-not $healthy) {
    $backupTag = "ghcr.io/ggml-org/llama.cpp:server-cuda-working"
    $originalTag = "ghcr.io/ggml-org/llama.cpp:server-cuda"
    $backupId = docker images -q $backupTag 2>$null

    if ($backupId) {
        Write-Host "[llamacpp] Falling back to previous working version..." -ForegroundColor Yellow
        docker-compose -f $ComposeFile stop llamacpp 2>$null
        docker-compose -f $ComposeFile rm -f llamacpp 2>$null
        docker tag $backupTag $originalTag 2>$null
        docker-compose -f $ComposeFile up -d llamacpp 2>$null
        Write-Host "[llamacpp] Fallback complete - restarted with previous working version"
    } else {
        Write-Host "[llamacpp] No backup image available, cannot fall back" -ForegroundColor Red
    }
}
