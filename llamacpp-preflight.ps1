param(
    [string]$ComposeFile = "docker-compose.yml"
)

$image = "ghcr.io/ggml-org/llama.cpp:server-cuda"
$backupTag = "ghcr.io/ggml-org/llama.cpp:server-cuda-working"

$currentId = docker images -q $image
if ($currentId) {
    Write-Host "[llamacpp] Backing up current image as $backupTag"
    docker tag $image $backupTag 2>$null
    Write-Host "[llamacpp] Backup saved"
} else {
    Write-Host "[llamacpp] No existing image found, fresh start"
}

Write-Host "[llamacpp] Pulling latest $image ..."
docker pull $image
Write-Host "[llamacpp] Pull complete"
