$ports = 9230,9232,9233,9237,9240,9250
foreach ($port in $ports) {
  try {
    $rows = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 2
    Write-Host "=== port $port count=$($rows.Count) ==="
    foreach ($row in $rows) {
      $url = [string]$row.url
      if ($url -match 'hotjob|gtht|resumeOperation|chrome-extension://hdek') {
        $short = if ($url.Length -gt 140) { $url.Substring(0,140) } else { $url }
        Write-Host ("{0} | {1}" -f $row.type, $short)
      }
    }
  } catch {
    Write-Host ("port {0} fail: {1}" -f $port, $_.Exception.Message)
  }
}
