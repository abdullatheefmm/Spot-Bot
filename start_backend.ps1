# SpotBot - Start Backend
Write-Host "Starting SpotBot Backend..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\backend
pip install -r requirements.txt
python main.py
