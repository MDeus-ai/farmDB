param(
  [string]$SourceIcon = "assets/icons/barn.png"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$resolvedSource = Resolve-Path $SourceIcon
$srcBitmap = [System.Drawing.Bitmap]::FromFile($resolvedSource.Path)

function Save-ResizedPng {
  param(
    [System.Drawing.Image]$Image,
    [string]$OutPath,
    [int]$Size,
    [double]$InnerRatio = 1.0,
    [System.Drawing.Color]$BgColor = [System.Drawing.Color]::Transparent
  )

  $dir = Split-Path -Parent $OutPath
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($BgColor -eq [System.Drawing.Color]::Transparent) {
      $gfx.Clear([System.Drawing.Color]::Transparent)
    } else {
      $gfx.Clear($BgColor)
    }

    $drawSize = [int][Math]::Round($Size * $InnerRatio)
    $offset = [int][Math]::Floor(($Size - $drawSize) / 2.0)
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $drawSize, $drawSize)
    $gfx.DrawImage($Image, $destRect)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $gfx.Dispose()
    $bmp.Dispose()
  }
}

function Save-SolidPng {
  param(
    [string]$OutPath,
    [int]$Size,
    [System.Drawing.Color]$Color
  )
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $gfx.Clear($Color)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $gfx.Dispose()
    $bmp.Dispose()
  }
}

function Save-MultiSizeIco {
  param(
    [System.Drawing.Image]$Image,
    [string]$OutPath,
    [int[]]$Sizes = @(16, 32, 48, 64, 128, 256)
  )

  $pngStreams = @()
  foreach ($s in $Sizes) {
    $ms = New-Object System.IO.MemoryStream
    $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $gfx.Clear([System.Drawing.Color]::Transparent)
      $gfx.DrawImage($Image, 0, 0, $s, $s)
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $pngStreams += ,$ms.ToArray()
    } finally {
      $gfx.Dispose()
      $bmp.Dispose()
      $ms.Dispose()
    }
  }

  $fs = [System.IO.File]::Open($OutPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $bw = New-Object System.IO.BinaryWriter($fs)
  try {
    $count = $Sizes.Length
    $bw.Write([UInt16]0)      # Reserved
    $bw.Write([UInt16]1)      # Type: ICO
    $bw.Write([UInt16]$count) # Count

    $offset = 6 + ($count * 16)
    for ($i = 0; $i -lt $count; $i++) {
      $sz = $Sizes[$i]
      $data = $pngStreams[$i]
      $dimByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
      $bw.Write($dimByte)
      $bw.Write($dimByte)
      $bw.Write([byte]0)
      $bw.Write([byte]0)
      $bw.Write([UInt16]1)
      $bw.Write([UInt16]32)
      $bw.Write([UInt32]$data.Length)
      $bw.Write([UInt32]$offset)
      $offset += $data.Length
    }

    foreach ($data in $pngStreams) {
      $bw.Write($data)
    }
  } finally {
    $bw.Dispose()
    $fs.Dispose()
  }
}

try {
  $softGreenBg = [System.Drawing.Color]::FromArgb(255, 230, 242, 236) # #e6f2ec

  # Desktop / Tauri icons
  $tauriDir = "apps/desktop/src-tauri/icons"
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/32x32.png" -Size 32
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/128x128.png" -Size 128
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/128x128@2x.png" -Size 256
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/icon.png" -Size 512
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square30x30Logo.png" -Size 30
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square44x44Logo.png" -Size 44
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square71x71Logo.png" -Size 71
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square89x89Logo.png" -Size 89
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square107x107Logo.png" -Size 107
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square142x142Logo.png" -Size 142
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square150x150Logo.png" -Size 150
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square284x284Logo.png" -Size 284
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/Square310x310Logo.png" -Size 310
  Save-ResizedPng -Image $srcBitmap -OutPath "$tauriDir/StoreLogo.png" -Size 50
  Save-MultiSizeIco -Image $srcBitmap -OutPath "$tauriDir/icon.ico"

  # Desktop web favicon
  Save-ResizedPng -Image $srcBitmap -OutPath "apps/desktop/public/barn.png" -Size 128

  # Mobile Expo icons
  $mobDir = "apps/mobile/assets"
  Save-ResizedPng -Image $srcBitmap -OutPath "$mobDir/icon.png" -Size 1024 -InnerRatio 0.80 -BgColor $softGreenBg
  Save-ResizedPng -Image $srcBitmap -OutPath "$mobDir/android-icon-foreground.png" -Size 1024 -InnerRatio 0.66
  Save-SolidPng -OutPath "$mobDir/android-icon-background.png" -Size 1024 -Color $softGreenBg
  Save-ResizedPng -Image $srcBitmap -OutPath "$mobDir/android-icon-monochrome.png" -Size 1024 -InnerRatio 0.66
  Save-ResizedPng -Image $srcBitmap -OutPath "$mobDir/splash-icon.png" -Size 1024 -InnerRatio 0.72
  Save-ResizedPng -Image $srcBitmap -OutPath "$mobDir/favicon.png" -Size 64

  # Mirror all central PNG icons into Mobile local assets directory for reliable Metro bundling
  $mobIconsDir = "apps/mobile/assets/icons"
  if (!(Test-Path $mobIconsDir)) {
    New-Item -ItemType Directory -Force -Path $mobIconsDir | Out-Null
  }
  Copy-Item -Force "assets/icons/*.png" $mobIconsDir

  Write-Host "Synchronized barn.png into Tauri desktop, Vite public favicon, and Expo mobile assets."
} finally {
  $srcBitmap.Dispose()
}
