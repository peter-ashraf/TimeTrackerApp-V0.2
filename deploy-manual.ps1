# Build
npm run build

# Deploy
cd dist
if (Test-Path .git) { Remove-Item -Recurse -Force .git }
git init
git add -A
git commit -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push -f https://github.com/peter-ashraf/TimeTrackerApp-V0.2.git HEAD:gh-pages
cd ..

Write-Host "✅ Deployed successfully!" -ForegroundColor Green
Write-Host "🌐 Visit: https://peter-ashraf.github.io/TimeTrackerApp-V0.2/" -ForegroundColor Cyan
