Write-Host "Checking Docker Container Status..."
docker ps

Write-Host "`nTesting Agent Manager (Port 8000)..."
try {
    $res = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 5
    Write-Host "Agent Manager OK: $($res.StatusCode)"
} catch {
    Write-Host "Agent Manager Failed: $($_.Exception.Message)"
}

Write-Host "`nTesting Frontend (Port 3000)..."
try {
    $res = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "Frontend OK: $($res.StatusCode)"
} catch {
    Write-Host "Frontend Failed: $($_.Exception.Message)"
}

Write-Host "`nTesting IBM MQ MCP Server (Port 8001)..."
try {
    $res = Invoke-WebRequest -Uri "http://localhost:8001" -UseBasicParsing -TimeoutSec 5
    Write-Host "IBM MQ MCP OK: $($res.StatusCode)"
} catch {
    Write-Host "IBM MQ MCP response (may be expected if no GET route exists): $($_.Exception.Message)"
}
