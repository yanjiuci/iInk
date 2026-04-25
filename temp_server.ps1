$root = 'D:\\下载\\iInk'
$prefix = 'http://127.0.0.1:5500/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Serving $root on $prefix"
while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $req = $context.Request
    $localPath = $req.Url.LocalPath
    if ($localPath -eq '/') { $localPath = '/index.html' }
    $filePath = Join-Path $root ($localPath.TrimStart('/').Replace('/','\\'))
    if (Test-Path -Path $filePath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      switch ($ext) {
        '.html' { $ctype = 'text/html' }
        '.js'   { $ctype = 'application/javascript' }
        '.css'  { $ctype = 'text/css' }
        '.json' { $ctype = 'application/json' }
        '.png'  { $ctype = 'image/png' }
        '.jpg'  { $ctype = 'image/jpeg' }
        '.jpeg' { $ctype = 'image/jpeg' }
        '.svg'  { $ctype = 'image/svg+xml' }
        default { $ctype = 'application/octet-stream' }
      }
      $context.Response.ContentType = $ctype
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
      $context.Response.OutputStream.Close()
    } else {
      $context.Response.StatusCode = 404
      $context.Response.Close()
    }
  } catch {
    $err = $_.Exception | Out-String
    Write-Output "[temp_server] ERROR serving $($req.Url): $err"
    try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
  }
}
