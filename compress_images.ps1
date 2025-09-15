# 图片压缩脚本
# 此脚本使用System.Drawing来调整图片大小，减少文件体积

# 目标目录 - 现在支持多个分包目录
$targetDirs = @(
    "D:\Projects\Eatigo\images\restaurants",
    "D:\Projects\Eatigo\packageA\images\restaurants",
    "D:\Projects\Eatigo\packageB\images\restaurants"
)

# 确保目标目录存在并收集所有图片文件
$allPngFiles = @()
foreach ($targetDir in $targetDirs) {
    if (Test-Path $targetDir) {
        $pngFiles = Get-ChildItem -Path $targetDir -Filter "*.png"
        $allPngFiles += $pngFiles
        Write-Host "找到目录: $targetDir ($($pngFiles.Count) 个文件)" -ForegroundColor Yellow
    } else {
        Write-Host "目录不存在，跳过: $targetDir" -ForegroundColor Gray
    }
}

# 加载System.Drawing程序集
Add-Type -AssemblyName System.Drawing

# 统计信息
$totalFiles = $allPngFiles.Count
$processedFiles = 0
$totalOriginalSize = 0
$totalOptimizedSize = 0

Write-Host "开始压缩 $totalFiles 个图片文件..." -ForegroundColor Cyan

# 处理每个图片
foreach ($file in $allPngFiles) {
    $processedFiles++
    $originalSize = $file.Length
    $totalOriginalSize += $originalSize
    
    $filePath = $file.FullName
    $tempPath = "$filePath.temp"
    
    # 显示进度
    Write-Progress -Activity "压缩图片" -Status "处理: $($file.Name)" -PercentComplete (($processedFiles / $totalFiles) * 100)
    
    try {
        # 加载图片
        $image = [System.Drawing.Image]::FromFile($filePath)
        
        # 计算新尺寸 (最大宽度150px，保持比例)
        $maxWidth = 150
        $ratio = $maxWidth / $image.Width
        $newWidth = [int]($image.Width * $ratio)
        $newHeight = [int]($image.Height * $ratio)
        
        # 如果图片已经小于最大宽度，保持原尺寸
        if ($image.Width -le $maxWidth) {
            $newWidth = $image.Width
            $newHeight = $image.Height
        }
        
        # 创建新的缩小版图片
        $newImage = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
        $graphics = [System.Drawing.Graphics]::FromImage($newImage)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)
        
        # 保存为新文件
        $newImage.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # 释放资源
        $graphics.Dispose()
        $newImage.Dispose()
        $image.Dispose()
        
        # 替换原文件
        Remove-Item -Path $filePath -Force
        Rename-Item -Path $tempPath -NewName $file.Name -Force
        
        # 获取优化后的大小
        $optimizedFile = Get-Item $filePath
        $optimizedSize = $optimizedFile.Length
        $totalOptimizedSize += $optimizedSize
        
        # 计算节省的空间
        $savedSize = $originalSize - $optimizedSize
        $savedPercent = [math]::Round(($savedSize / $originalSize) * 100, 2)
        
        Write-Host "[$processedFiles/$totalFiles] $($file.Name): $($originalSize/1KB)KB -> $($optimizedSize/1KB)KB (节省 $savedPercent%)" -ForegroundColor Green
    }
    catch {
        Write-Host "[$processedFiles/$totalFiles] 处理 $($file.Name) 时出错: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 显示总结
$totalSavedSize = $totalOriginalSize - $totalOptimizedSize
$totalSavedPercent = [math]::Round(($totalSavedSize / $totalOriginalSize) * 100, 2)

Write-Host ""
Write-Host "压缩完成!" -ForegroundColor Cyan
Write-Host "总原始大小: $($totalOriginalSize/1KB)KB" -ForegroundColor White
Write-Host "总压缩后大小: $($totalOptimizedSize/1KB)KB" -ForegroundColor White
Write-Host "总节省空间: $($totalSavedSize/1KB)KB ($totalSavedPercent%)" -ForegroundColor Green