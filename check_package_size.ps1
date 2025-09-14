# 检查包大小脚本

# 定义要检查的目录
$mainPackageDir = "D:\Projects\Eatigo"
$subPackageDir = "D:\Projects\Eatigo\packageRestaurant"

# 排除的目录
$excludeDirs = @(
    "$mainPackageDir\packageRestaurant",
    "$mainPackageDir\node_modules"
)

# 计算主包大小
Write-Host "正在计算主包大小..." -ForegroundColor Cyan
$mainPackageSize = 0
$mainPackageFiles = Get-ChildItem -Path $mainPackageDir -Recurse -File | Where-Object {
    $filePath = $_.FullName
    $exclude = $false
    foreach ($dir in $excludeDirs) {
        if ($filePath.StartsWith($dir)) {
            $exclude = $true
            break
        }
    }
    -not $exclude
}

$mainPackageSize = ($mainPackageFiles | Measure-Object -Property Length -Sum).Sum

# 计算分包大小
Write-Host "正在计算分包大小..." -ForegroundColor Cyan
$subPackageSize = 0
$subPackageFiles = Get-ChildItem -Path $subPackageDir -Recurse -File
$subPackageSize = ($subPackageFiles | Measure-Object -Property Length -Sum).Sum

# 显示结果
Write-Host ""
Write-Host "包大小统计:" -ForegroundColor Cyan
Write-Host "主包大小: $([math]::Round($mainPackageSize / 1MB, 2)) MB" -ForegroundColor White
Write-Host "分包大小: $([math]::Round($subPackageSize / 1MB, 2)) MB" -ForegroundColor White
Write-Host "总大小: $([math]::Round(($mainPackageSize + $subPackageSize) / 1MB, 2)) MB" -ForegroundColor White

# 检查是否符合微信小程序限制
$mainPackageSizeMB = $mainPackageSize / 1MB
$subPackageSizeMB = $subPackageSize / 1MB

Write-Host ""
if ($mainPackageSizeMB -le 2) {
    Write-Host "✓ 主包大小符合微信小程序2MB限制" -ForegroundColor Green
} else {
    Write-Host "✗ 主包大小超过微信小程序2MB限制" -ForegroundColor Red
    Write-Host "  超出: $([math]::Round($mainPackageSizeMB - 2, 2)) MB" -ForegroundColor Red
}

if ($subPackageSizeMB -le 2) {
    Write-Host "✓ 分包大小符合微信小程序2MB限制" -ForegroundColor Green
} else {
    Write-Host "✗ 分包大小超过微信小程序2MB限制" -ForegroundColor Red
    Write-Host "  超出: $([math]::Round($subPackageSizeMB - 2, 2)) MB" -ForegroundColor Red
}