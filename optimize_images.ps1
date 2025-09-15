# 图片移动脚本

# 源目录和目标目录 - 更新为新的分包结构
$sourceDir = "D:\Projects\Eatigo\images\restaurants"
$targetDirs = @(
    "D:\Projects\Eatigo\packageA\images\restaurants",
    "D:\Projects\Eatigo\packageB\images\restaurants"
)

# 确保目标目录存在
foreach ($targetDir in $targetDirs) {
    if (-not (Test-Path $targetDir)) {
        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
        Write-Host "创建目录: $targetDir" -ForegroundColor Yellow
    }
}

Write-Host "注意: 此脚本已更新为支持新的分包结构" -ForegroundColor Cyan
Write-Host "图片现在应该已经通过其他方式移动到正确的分包目录中" -ForegroundColor Cyan
Write-Host "如需重新分配图片，请手动执行相应的移动命令" -ForegroundColor Yellow

# 检查各目录中的文件数量
foreach ($targetDir in $targetDirs) {
    if (Test-Path $targetDir) {
        $fileCount = (Get-ChildItem -Path $targetDir -Filter "*.png").Count
        Write-Host "$targetDir: $fileCount 个文件" -ForegroundColor Green
    }
}

# 检查主包目录
if (Test-Path $sourceDir) {
    $mainFileCount = (Get-ChildItem -Path $sourceDir -Filter "*.png").Count
    Write-Host "$sourceDir: $mainFileCount 个文件" -ForegroundColor Green
}

# 显示总结
Write-Host ""
Write-Host "分包结构检查完成!" -ForegroundColor Cyan
Write-Host ""
Write-Host "注意: 图片已按分包结构组织，如需压缩优化请运行 compress_images.ps1" -ForegroundColor Yellow
Write-Host "建议使用图片压缩工具对图片进行进一步优化以减少包体积。" -ForegroundColor Yellow