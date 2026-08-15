# Generates the app icon (green rounded square + white VPN shield)
# matching the Android launcher icon of MrOpenVPN Client.
param()

Add-Type -AssemblyName System.Drawing

$size = 256
$scale = $size / 108.0
$bgColor = [System.Drawing.Color]::FromArgb(255, 0x00, 0xE6, 0x76)
$fgColor = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function Scale-Point([double]$x, [double]$y) {
    return [System.Drawing.PointF]::new(
        [single]($x * $scale),
        [single]($y * $scale)
    )
}

$radius = [single](22.0 * $scale)
$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bgPath.AddArc($rect.X, $rect.Y, 2 * $radius, 2 * $radius, 180, 90)
$bgPath.AddArc($rect.Right - 2 * $radius, $rect.Y, 2 * $radius, 2 * $radius, 270, 90)
$bgPath.AddArc($rect.Right - 2 * $radius, $rect.Bottom - 2 * $radius, 2 * $radius, 2 * $radius, 0, 90)
$bgPath.AddArc($rect.X, $rect.Bottom - 2 * $radius, 2 * $radius, 2 * $radius, 90, 90)
$bgPath.CloseFigure()
$bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillPath($bgBrush, $bgPath)

# Shield shape from ic_launcher_foreground.xml
# M54,26 L80,36 L80,52 C80,66 68,76 54,82 C40,76 28,66 28,52 L28,36 Z
$shield = New-Object System.Drawing.Drawing2D.GraphicsPath
$shield.AddLine((Scale-Point 54 26), (Scale-Point 80 36))
$shield.AddLine((Scale-Point 80 36), (Scale-Point 80 52))
$shield.AddBezier(
    (Scale-Point 80 52), (Scale-Point 80 66),
    (Scale-Point 68 76), (Scale-Point 54 82)
)
$shield.AddBezier(
    (Scale-Point 54 82), (Scale-Point 40 76),
    (Scale-Point 28 66), (Scale-Point 28 52)
)
$shield.AddLine((Scale-Point 28 52), (Scale-Point 28 36))
$shield.AddLine((Scale-Point 28 36), (Scale-Point 54 26))
$shield.CloseFigure()
$fgBrush = New-Object System.Drawing.SolidBrush($fgColor)
$g.FillPath($fgBrush, $shield)

$outDir = Join-Path $PSScriptRoot "..\assets"
$outFile = Join-Path $outDir "icon.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bgBrush.Dispose()
$fgBrush.Dispose()
$bgPath.Dispose()
$shield.Dispose()
$bmp.Dispose()

Write-Output "saved: $outFile"
