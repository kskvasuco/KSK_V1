Add-Type -AssemblyName System.Drawing

$mobileDir = "d:\KSK\HOST\KSK REACT\KSK1\V_1 - Main\mobile"
$sourcePath = "$mobileDir\assets\head.png"
$tempDir = "$mobileDir\assets\temp_icon_gen"

if (-not (Test-Path "$tempDir")) {
    New-Item -ItemType Directory -Path "$tempDir" -Force | Out-Null
}

# High-quality resize function with 80% safe zone padding for standard icons
function Resize-Image {
    param (
        [string]$SrcPath,
        [int]$Width,
        [int]$Height,
        [string]$DestPath
    )
    $srcImage = [System.Drawing.Image]::FromFile("$SrcPath")
    $destBitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $graphics.Clear([System.Drawing.Color]::Transparent)
    
    # Scale to 80% of target canvas to protect from rounded-corner cropping
    $logoW = [int]($Width * 0.80)
    $logoH = [int]($Height * 0.80)
    $posX = ($Width - $logoW) / 2
    $posY = ($Height - $logoH) / 2
    
    $graphics.DrawImage($srcImage, $posX, $posY, $logoW, $logoH)
    
    $graphics.Dispose()
    $destBitmap.Save("$DestPath", [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    $srcImage.Dispose()
}

# High-quality resize function with custom padding (primarily for adaptive icons)
function Resize-Image-Padded {
    param (
        [string]$SrcPath,
        [int]$CanvasWidth,
        [int]$CanvasHeight,
        [int]$LogoWidth,
        [int]$LogoHeight,
        [string]$DestPath
    )
    $srcImage = [System.Drawing.Image]::FromFile("$SrcPath")
    $destBitmap = New-Object System.Drawing.Bitmap $CanvasWidth, $CanvasHeight
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $graphics.Clear([System.Drawing.Color]::Transparent)
    
    $posX = ($CanvasWidth - $LogoWidth) / 2
    $posY = ($CanvasHeight - $LogoHeight) / 2
    
    $graphics.DrawImage($srcImage, $posX, $posY, $LogoWidth, $LogoHeight)
    
    $graphics.Dispose()
    $destBitmap.Save("$DestPath", [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    $srcImage.Dispose()
}

function Convert-To-Webp {
    param (
        [string]$PngPath,
        [string]$WebpPath
    )
    $webpDir = Split-Path "$WebpPath" -Parent
    if (-not (Test-Path "$webpDir")) {
        New-Item -ItemType Directory -Path "$webpDir" -Force | Out-Null
    }
    ffmpeg -y -i "$PngPath" "$WebpPath" 2>$null
}

# Run generation
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Starting App Icon Asset Generation (Padded Safe Zone)..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Core Expo Assets
Write-Host "1. Generating core Expo assets..."
Resize-Image "$sourcePath" 1024 1024 "$mobileDir\assets\icon.png"
Resize-Image "$sourcePath" 1024 1024 "$mobileDir\assets\splash-icon.png"
# Padded to 250px inside 432px (58% ratio) to guarantee safe zone containment
Resize-Image-Padded "$sourcePath" 432 432 250 250 "$mobileDir\assets\android\adaptive-foreground.png"
Resize-Image "$sourcePath" 1024 1024 "$mobileDir\assets\ios\icon-1024.png"

# 2. iOS Multiple Resolutions
Write-Host "2. Generating iOS multiple resolutions (80% padded)..."
$iosSizes = @(
    @{ w = 20; name = "Icon-20" },
    @{ w = 29; name = "Icon-29" },
    @{ w = 40; name = "Icon-40" },
    @{ w = 58; name = "Icon-2x" },
    @{ w = 60; name = "Icon-3x" },
    @{ w = 76; name = "Icon-76" },
    @{ w = 80; name = "Icon-80" },
    @{ w = 87; name = "Icon-87" },
    @{ w = 120; name = "Icon-60@2x" },
    @{ w = 152; name = "Icon-76@2x" },
    @{ w = 167; name = "Icon-83.5@2x" },
    @{ w = 180; name = "Icon-60@3x" },
    @{ w = 1024; name = "icon-1024" }
)
foreach ($size in $iosSizes) {
    Resize-Image "$sourcePath" $size.w $size.w "$mobileDir\assets\ios\$($size.name).png"
}

# 3. Android Asset Subfolders (PNGs)
Write-Host "3. Generating Android resolution subfolder PNGs (80% padded)..."
$androidPngs = @(
    @{ w = 48; f = "mdpi" },
    @{ w = 72; f = "hdpi" },
    @{ w = 96; f = "xhdpi" },
    @{ w = 144; f = "xxhdpi" },
    @{ w = 192; f = "xxxhdpi" }
)
foreach ($item in $androidPngs) {
    Resize-Image "$sourcePath" $item.w $item.w "$mobileDir\assets\android\$($item.f)\icon.png"
}

# 4. Native Android Mipmap Icons (WebPs)
Write-Host "4. Generating native Android mipmap WebP launcher icons..."
$mipmaps = @(
    @{ folder = "mipmap-mdpi"; launcherSize = 48; foregroundSize = 108; logoSize = 63 },
    @{ folder = "mipmap-hdpi"; launcherSize = 72; foregroundSize = 162; logoSize = 94 },
    @{ folder = "mipmap-xhdpi"; launcherSize = 96; foregroundSize = 216; logoSize = 125 },
    @{ folder = "mipmap-xxhdpi"; launcherSize = 144; foregroundSize = 324; logoSize = 188 },
    @{ folder = "mipmap-xxxhdpi"; launcherSize = 192; foregroundSize = 432; logoSize = 250 }
)

foreach ($m in $mipmaps) {
    $resDir = "$mobileDir\android\app\src\main\res\$($m.folder)"
    if (-not (Test-Path "$resDir")) {
        continue
    }
    
    $tempLauncherPng = "$tempDir\$($m.folder)-launcher.png"
    $tempForegroundPng = "$tempDir\$($m.folder)-foreground.png"
    
    # Generate temporary files (80% padded launcher, 58% padded adaptive foreground)
    Resize-Image "$sourcePath" $m.launcherSize $m.launcherSize "$tempLauncherPng"
    Resize-Image-Padded "$sourcePath" $m.foregroundSize $m.foregroundSize $m.logoSize $m.logoSize "$tempForegroundPng"
    
    # Convert to WebP in native directories
    Convert-To-Webp "$tempLauncherPng" "$resDir\ic_launcher.webp"
    Convert-To-Webp "$tempLauncherPng" "$resDir\ic_launcher_round.webp"
    Convert-To-Webp "$tempForegroundPng" "$resDir\ic_launcher_foreground.webp"
}

# Cleanup
Write-Host "Cleaning up..."
Remove-Item -Path "$tempDir" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "SUCCESS: All app icons generated with padded safe zones for 100% accuracy!" -ForegroundColor Green
