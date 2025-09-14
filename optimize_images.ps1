# 图片移动脚本

# 源目录和目标目录
$sourceDir = "D:\Projects\Eatigo\images\restaurantpic"
$targetDir = "D:\Projects\Eatigo\packageRestaurant\images\restaurantpic"

# 确保目标目录存在
if (-not (Test-Path $targetDir)) {
    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
}

# 获取所有PNG图片
$pngFiles = Get-ChildItem -Path $sourceDir -Filter "*.png"

# 统计信息
$totalFiles = $pngFiles.Count
$processedFiles = 0
$totalSize = 0

Write-Host "开始移动 $totalFiles 个图片文件到分包目录..." -ForegroundColor Cyan

# 处理每个图片
foreach ($file in $pngFiles) {
    $processedFiles++
    $fileSize = $file.Length
    $totalSize += $fileSize
    
    $sourcePath = $file.FullName
    $targetPath = Join-Path -Path $targetDir -ChildPath $file.Name
    
    # 显示进度
    Write-Progress -Activity "移动图片" -Status "处理: $($file.Name)" -PercentComplete (($processedFiles / $totalFiles) * 100)
    
    # 复制文件到目标目录
    Copy-Item -Path $sourcePath -Destination $targetPath -Force
    
    Write-Host "[$processedFiles/$totalFiles] 已移动: $($file.Name) ($($fileSize/1KB)KB)" -ForegroundColor Green
}

# 显示总结
Write-Host ""
Write-Host "移动完成!" -ForegroundColor Cyan
Write-Host "总文件数: $totalFiles" -ForegroundColor White
Write-Host "总大小: $($totalSize/1KB)KB" -ForegroundColor White
Write-Host ""
Write-Host "注意: 图片已移动到分包目录，但未进行压缩优化。" -ForegroundColor Yellow
Write-Host "建议使用图片压缩工具(如TinyPNG)对图片进行进一步优化。" -ForegroundColor Yellow