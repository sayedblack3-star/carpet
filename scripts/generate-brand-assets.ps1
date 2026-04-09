Add-Type -AssemblyName System.Drawing
Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @"
  [System.Runtime.InteropServices.DllImport("user32.dll", CharSet=System.Runtime.InteropServices.CharSet.Auto)]
  public static extern bool DestroyIcon(System.IntPtr handle);
"@

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicBrandDir = Join-Path $repoRoot 'public\brand'
$electronAssetsDir = Join-Path $repoRoot 'electron\assets'
$androidResDir = Join-Path $repoRoot 'android\app\src\main\res'
$webBrandDir = Join-Path $publicBrandDir 'web'
$desktopBrandDir = Join-Path $publicBrandDir 'desktop'
$mobileBrandDir = Join-Path $publicBrandDir 'mobile'

@($publicBrandDir, $electronAssetsDir, $webBrandDir, $desktopBrandDir, $mobileBrandDir) | ForEach-Object {
  if (-not (Test-Path $_)) {
    New-Item -ItemType Directory -Path $_ | Out-Null
  }
}

function New-Color([int]$a, [int]$r, [int]$g, [int]$b) {
  [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function Fill-RoundedRectangle($graphics, $brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-RoundedRectangle($graphics, $pen, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-PolygonShape($graphics, $brush, [System.Drawing.PointF[]]$points, $pen) {
  $graphics.FillPolygon($brush, $points)
  if ($pen) {
    $graphics.DrawPolygon($pen, $points)
  }
}

function New-MarkBitmap([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($size, $size)),
    (New-Color 255 16 11 7),
    (New-Color 255 37 25 18)
  )
  Fill-RoundedRectangle $graphics $backgroundBrush ($size * 0.055) ($size * 0.055) ($size * 0.89) ($size * 0.89) ($size * 0.18)

  $patternPen = New-Object System.Drawing.Pen (New-Color 28 255 215 150), ($size * 0.004)
  $step = [Math]::Max([int]($size * 0.07), 18)
  for ($offset = -$size; $offset -lt $size * 2; $offset += $step) {
    $graphics.DrawLine($patternPen, $offset, 0, $offset + $size, $size)
    $graphics.DrawLine($patternPen, $offset, $size, $offset + $size, 0)
  }

  $glowBrush = New-Object System.Drawing.SolidBrush (New-Color 24 245 178 76)
  $graphics.FillEllipse($glowBrush, $size * 0.18, $size * 0.16, $size * 0.64, $size * 0.64)
  $graphics.FillEllipse($glowBrush, $size * 0.26, $size * 0.2, $size * 0.48, $size * 0.48)

  $goldLight = New-Color 255 250 225 167
  $goldBase = New-Color 255 224 181 92
  $goldDark = New-Color 255 163 111 20
  $outlinePen = New-Object System.Drawing.Pen $goldLight, ($size * 0.013)
  $outlinePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $arcPen1 = New-Object System.Drawing.Pen $goldLight, ($size * 0.03)
  $arcPen2 = New-Object System.Drawing.Pen $goldBase, ($size * 0.022)
  $arcPen3 = New-Object System.Drawing.Pen $goldDark, ($size * 0.018)
  $arcPen1.StartCap = $arcPen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $arcPen2.StartCap = $arcPen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $arcPen3.StartCap = $arcPen3.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($arcPen1, $size * 0.22, $size * 0.18, $size * 0.56, $size * 0.56, 198, 150)
  $graphics.DrawArc($arcPen2, $size * 0.28, $size * 0.24, $size * 0.44, $size * 0.44, 198, 148)
  $graphics.DrawArc($arcPen3, $size * 0.33, $size * 0.29, $size * 0.34, $size * 0.34, 198, 146)

  $rugPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($size * 0.18, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.5, $size * 0.47),
    [System.Drawing.PointF]::new($size * 0.84, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.77, $size * 0.79),
    [System.Drawing.PointF]::new($size * 0.5, $size * 0.87),
    [System.Drawing.PointF]::new($size * 0.25, $size * 0.79)
  )
  $rugBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.PointF]::new($size * 0.22, $size * 0.5)),
    ([System.Drawing.PointF]::new($size * 0.78, $size * 0.82)),
    $goldLight,
    $goldDark
  )
  Draw-PolygonShape $graphics $rugBrush $rugPoints $outlinePen

  $rugInnerPen = New-Object System.Drawing.Pen (New-Color 190 255 244 220), ($size * 0.008)
  $rugInnerPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot
  $graphics.DrawArc($rugInnerPen, $size * 0.24, $size * 0.58, $size * 0.22, $size * 0.18, 180, 100)
  $graphics.DrawArc($rugInnerPen, $size * 0.54, $size * 0.58, $size * 0.18, $size * 0.16, 260, 88)
  for ($i = 0; $i -lt 6; $i++) {
    $x = $size * 0.24 + ($i * $size * 0.08)
    $graphics.DrawLine($rugInnerPen, $x, $size * 0.79, $x - ($size * 0.02), $size * 0.87)
  }

  $centerPeak = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($size * 0.5, $size * 0.24),
    [System.Drawing.PointF]::new($size * 0.64, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.5, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.43, $size * 0.51),
    [System.Drawing.PointF]::new($size * 0.36, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.31, $size * 0.61)
  )
  $leftPeak = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($size * 0.28, $size * 0.42),
    [System.Drawing.PointF]::new($size * 0.4, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.18, $size * 0.61)
  )
  $rightPeak = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($size * 0.71, $size * 0.42),
    [System.Drawing.PointF]::new($size * 0.82, $size * 0.61),
    [System.Drawing.PointF]::new($size * 0.61, $size * 0.61)
  )
  $peakBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.PointF]::new($size * 0.26, $size * 0.25)),
    ([System.Drawing.PointF]::new($size * 0.72, $size * 0.62)),
    $goldLight,
    $goldDark
  )
  Draw-PolygonShape $graphics $peakBrush $centerPeak $outlinePen
  Draw-PolygonShape $graphics $peakBrush $leftPeak $outlinePen
  Draw-PolygonShape $graphics $peakBrush $rightPeak $outlinePen

  $bitmap
}

function New-SplashBitmap([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($width, $height)),
    (New-Color 255 18 11 7),
    (New-Color 255 44 28 18)
  )
  $graphics.FillRectangle($bgBrush, 0, 0, $width, $height)

  $patternPen = New-Object System.Drawing.Pen (New-Color 22 255 215 150), ([Math]::Max($width, $height) * 0.002)
  $step = [Math]::Max([int]([Math]::Min($width, $height) * 0.06), 28)
  for ($offset = -$height; $offset -lt $width + $height; $offset += $step) {
    $graphics.DrawLine($patternPen, $offset, 0, $offset + $height, $height)
  }

  $markSize = [int]([Math]::Min($width, $height) * 0.34)
  $markBitmap = New-MarkBitmap $markSize
  $markX = [int](($width - $markSize) / 2)
  $markY = [int]($height * 0.18)
  $graphics.DrawImage($markBitmap, $markX, $markY, $markSize, $markSize)

  $goldBrush = New-Object System.Drawing.SolidBrush (New-Color 255 241 203 129)
  $softBrush = New-Object System.Drawing.SolidBrush (New-Color 255 217 176 87)
  $mutedBrush = New-Object System.Drawing.SolidBrush (New-Color 220 245 225 180)

  $titleFont = New-Object System.Drawing.Font 'Segoe UI', ([Math]::Min($width, $height) * 0.08), ([System.Drawing.FontStyle]::Bold)
  $subtitleFont = New-Object System.Drawing.Font 'Segoe UI', ([Math]::Min($width, $height) * 0.03), ([System.Drawing.FontStyle]::Bold)
  $footerFont = New-Object System.Drawing.Font 'Segoe UI', ([Math]::Min($width, $height) * 0.022), ([System.Drawing.FontStyle]::Bold)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center

  $graphics.DrawString('CARPET LAND', $titleFont, $goldBrush, ($width / 2), ($height * 0.63), $format)
  $graphics.DrawString('CARPETS AND HOME TEXTILES', $subtitleFont, $softBrush, ($width / 2), ($height * 0.73), $format)
  $graphics.DrawString('EST 1960', $footerFont, $mutedBrush, ($width / 2), ($height * 0.79), $format)

  $bitmap
}

function Save-Png($bitmap, [string]$path) {
  $directory = Split-Path -Parent $path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Ico($bitmap, [string]$path, [int[]]$sizes) {
  $entries = @()

  foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($bitmap, $size, $size)
    $memory = New-Object System.IO.MemoryStream
    $resized.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
    $entries += [pscustomobject]@{
      Size = $size
      Data = $memory.ToArray()
    }
    $memory.Dispose()
    $resized.Dispose()
  }

  $iconStream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($iconStream)
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$entries.Count)

  $offset = 6 + (16 * $entries.Count)
  foreach ($entry in $entries) {
    $sizeByte = if ($entry.Size -ge 256) { 0 } else { [byte]$entry.Size }
    $writer.Write($sizeByte)
    $writer.Write($sizeByte)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Data.Length)
    $writer.Write([UInt32]$offset)
    $offset += $entry.Data.Length
  }

  foreach ($entry in $entries) {
    $writer.Write($entry.Data)
  }

  [System.IO.File]::WriteAllBytes($path, $iconStream.ToArray())
  $writer.Dispose()
  $iconStream.Dispose()
}

function Save-WindowsIcon($bitmap, [string]$path, [int]$size) {
  $resized = New-Object System.Drawing.Bitmap($bitmap, $size, $size)
  $iconHandle = $resized.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
  $fileStream = [System.IO.File]::Open($path, [System.IO.FileMode]::Create)
  $icon.Save($fileStream)
  $fileStream.Dispose()
  $icon.Dispose()
  [Win32.NativeMethods]::DestroyIcon($iconHandle) | Out-Null
  $resized.Dispose()
}

$mark1024 = New-MarkBitmap 1024
Save-Png $mark1024 (Join-Path $publicBrandDir 'carpet-land-mark.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 512, 512)) (Join-Path $publicBrandDir 'carpet-land-mark-512.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 192, 192)) (Join-Path $publicBrandDir 'carpet-land-mark-192.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 512, 512)) (Join-Path $webBrandDir 'carpet-land-mark.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 512, 512)) (Join-Path $desktopBrandDir 'carpet-land-mark.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 256, 256)) (Join-Path $mobileBrandDir 'carpet-land-mark.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 180, 180)) (Join-Path $publicBrandDir 'apple-touch-icon.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 32, 32)) (Join-Path $repoRoot 'public\favicon-32x32.png')
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 16, 16)) (Join-Path $repoRoot 'public\favicon-16x16.png')
Save-Ico $mark1024 (Join-Path $repoRoot 'public\favicon.ico') @(16, 32, 48, 64, 128, 256)
Save-Png (New-Object System.Drawing.Bitmap($mark1024, 512, 512)) (Join-Path $electronAssetsDir 'icon.png')
Save-WindowsIcon $mark1024 (Join-Path $electronAssetsDir 'icon.ico') 256

$androidSizes = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}

foreach ($folder in $androidSizes.Keys) {
  $size = $androidSizes[$folder]
  $resized = New-Object System.Drawing.Bitmap($mark1024, $size, $size)
  Save-Png $resized (Join-Path $androidResDir "$folder\ic_launcher.png")
  Save-Png $resized (Join-Path $androidResDir "$folder\ic_launcher_round.png")
  Save-Png $resized (Join-Path $androidResDir "$folder\ic_launcher_foreground.png")
}

$splashTargets = @{
  'drawable-port-mdpi\splash.png' = @(320, 480)
  'drawable-port-hdpi\splash.png' = @(480, 800)
  'drawable-port-xhdpi\splash.png' = @(720, 1280)
  'drawable-port-xxhdpi\splash.png' = @(960, 1600)
  'drawable-port-xxxhdpi\splash.png' = @(1280, 1920)
  'drawable-land-mdpi\splash.png' = @(480, 320)
  'drawable-land-hdpi\splash.png' = @(800, 480)
  'drawable-land-xhdpi\splash.png' = @(1280, 720)
  'drawable-land-xxhdpi\splash.png' = @(1600, 960)
  'drawable-land-xxxhdpi\splash.png' = @(1920, 1280)
  'drawable\splash.png' = @(960, 1600)
}

foreach ($target in $splashTargets.GetEnumerator()) {
  $dimensions = $target.Value
  $splash = New-SplashBitmap $dimensions[0] $dimensions[1]
  Save-Png $splash (Join-Path $androidResDir $target.Key)
}

$mark1024.Dispose()
