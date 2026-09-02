param(
  [Parameter(Mandatory = $true)]
  [string]$HelperSource,

  [Parameter(Mandatory = $true)]
  [string]$RepairedSource
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
$runtimeRoot = Split-Path -Parent $drawingAssembly
$compilerReferences = @(
  (Join-Path $runtimeRoot 'System.Private.CoreLib.dll'),
  (Join-Path $runtimeRoot 'System.Runtime.dll'),
  (Join-Path $runtimeRoot 'System.Collections.dll'),
  (Join-Path $runtimeRoot 'System.Drawing.Primitives.dll'),
  $drawingAssembly
)
Add-Type -ReferencedAssemblies $compilerReferences -TypeDefinition @'
using System;
using System.Drawing;

public static class RobotV2AlphaCleanup
{
    public static void RemoveLowAlphaHaze(Bitmap bitmap, byte threshold)
    {
        for (int y = 0; y < bitmap.Height; y++)
        {
            for (int x = 0; x < bitmap.Width; x++)
            {
                Color color = bitmap.GetPixel(x, y);
                if (color.A <= threshold)
                {
                    bitmap.SetPixel(x, y, Color.Transparent);
                    continue;
                }
                int normalizedAlpha = (int)Math.Round((color.A - threshold) * 255.0 / (255 - threshold));
                bitmap.SetPixel(x, y, Color.FromArgb(normalizedAlpha, color.R, color.G, color.B));
            }
        }
    }

    public static void KeepLargestConnectedComponent(Bitmap bitmap, byte threshold)
    {
        int width = bitmap.Width;
        int height = bitmap.Height;
        int pixelCount = width * height;
        int[] labels = new int[pixelCount];
        int[] queue = new int[pixelCount];
        int nextLabel = 0;
        int largestLabel = 0;
        int largestSize = 0;
        int[] dx = { -1, 0, 1, -1, 1, -1, 0, 1 };
        int[] dy = { -1, -1, -1, 0, 0, 1, 1, 1 };

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int start = y * width + x;
                if (labels[start] != 0 || bitmap.GetPixel(x, y).A <= threshold) continue;

                nextLabel++;
                int head = 0;
                int tail = 0;
                int componentSize = 0;
                labels[start] = nextLabel;
                queue[tail++] = start;

                while (head < tail)
                {
                    int current = queue[head++];
                    componentSize++;
                    int currentX = current % width;
                    int currentY = current / width;

                    for (int i = 0; i < dx.Length; i++)
                    {
                        int nextX = currentX + dx[i];
                        int nextY = currentY + dy[i];
                        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
                        int next = nextY * width + nextX;
                        if (labels[next] != 0 || bitmap.GetPixel(nextX, nextY).A <= threshold) continue;
                        labels[next] = nextLabel;
                        queue[tail++] = next;
                    }
                }

                if (componentSize > largestSize)
                {
                    largestSize = componentSize;
                    largestLabel = nextLabel;
                }
            }
        }

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int index = y * width + x;
                if (labels[index] != largestLabel) bitmap.SetPixel(x, y, Color.Transparent);
            }
        }
    }
}
'@

$projectRoot = Split-Path -Parent $PSScriptRoot
$referenceRoot = Join-Path $projectRoot 'docs/references/robot-style-v2'
$outputRoot = Join-Path $projectRoot 'public/assets/characters/robot-v2'
$partsRoot = Join-Path $outputRoot 'parts'

New-Item -ItemType Directory -Force -Path $partsRoot | Out-Null

function Get-AlphaBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Threshold = 8
  )

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      if ($Bitmap.GetPixel($x, $y).A -le $Threshold) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt $minX -or $maxY -lt $minY) {
    throw 'The source image contains no visible alpha pixels.'
  }

  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function Save-TrimmedBitmap {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Destination,
    [int]$Padding = 12
  )

  $bounds = Get-AlphaBounds -Bitmap $Bitmap
  $canvas = New-Object System.Drawing.Bitmap ($bounds.Width + $Padding * 2), ($bounds.Height + $Padding * 2), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $source = New-Object System.Drawing.Rectangle $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height
    $target = New-Object System.Drawing.Rectangle $Padding, $Padding, $bounds.Width, $bounds.Height
    $graphics.DrawImage($Bitmap, $target, $source, [System.Drawing.GraphicsUnit]::Pixel)
    $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

function Save-TrimmedFile {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$Padding = 12,
    [switch]$CleanExtractionAlpha
  )

  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Source))
  try {
    if ($CleanExtractionAlpha) { [RobotV2AlphaCleanup]::RemoveLowAlphaHaze($bitmap, 32) }
    Save-TrimmedBitmap -Bitmap $bitmap -Destination $Destination -Padding $Padding
  }
  finally { $bitmap.Dispose() }
}

function Save-Part {
  param(
    [System.Drawing.Bitmap]$Sheet,
    [System.Drawing.Rectangle]$Region,
    [string]$Destination
  )

  $crop = New-Object System.Drawing.Bitmap $Region.Width, $Region.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $target = New-Object System.Drawing.Rectangle 0, 0, $Region.Width, $Region.Height
    $graphics.DrawImage($Sheet, $target, $Region, [System.Drawing.GraphicsUnit]::Pixel)
    [RobotV2AlphaCleanup]::KeepLargestConnectedComponent($crop, 2)
    Save-TrimmedBitmap -Bitmap $crop -Destination $Destination -Padding 10
  }
  finally {
    $graphics.Dispose()
    $crop.Dispose()
  }
}

Save-TrimmedFile -Source $HelperSource -Destination (Join-Path $outputRoot 'robot-helper.png') -Padding 16 -CleanExtractionAlpha
Save-TrimmedFile -Source $RepairedSource -Destination (Join-Path $outputRoot 'robot-repaired.png') -Padding 16
Save-TrimmedFile -Source (Join-Path $referenceRoot 'robot-duo.png') -Destination (Join-Path $outputRoot 'robot-duo.png') -Padding 16

$sheet = [System.Drawing.Bitmap]::FromFile((Join-Path $referenceRoot 'robot-disassembled.png'))
try {
  $regions = [ordered]@{
    'robot-head.png' = New-Object System.Drawing.Rectangle 140, 0, 700, 475
    'robot-antenna.png' = New-Object System.Drawing.Rectangle 850, 55, 235, 355
    'robot-arm-left.png' = New-Object System.Drawing.Rectangle 0, 430, 455, 410
    'robot-body.png' = New-Object System.Drawing.Rectangle 490, 430, 455, 405
    'robot-arm-right.png' = New-Object System.Drawing.Rectangle 995, 430, 453, 410
    'robot-leg-left.png' = New-Object System.Drawing.Rectangle 225, 650, 390, 436
    'robot-leg-right.png' = New-Object System.Drawing.Rectangle 845, 650, 445, 436
  }

  foreach ($entry in $regions.GetEnumerator()) {
    Save-Part -Sheet $sheet -Region $entry.Value -Destination (Join-Path $partsRoot $entry.Key)
  }
}
finally {
  $sheet.Dispose()
}

Get-ChildItem -LiteralPath $outputRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
  $bitmap = [System.Drawing.Bitmap]::FromFile($_.FullName)
  try { '{0}`t{1}x{2}`t{3}' -f $_.FullName, $bitmap.Width, $bitmap.Height, $bitmap.PixelFormat }
  finally { $bitmap.Dispose() }
}
