# ================================================================
#   Google Cloud Model API & Gemini: ADC setup script for Windows
# ================================================================
# This script is a PowerShell equivalent of Google's setup_adc.sh,
# designed to work natively on Windows to install/locate gcloud CLI,
# authenticate application-default credentials, configure project settings,
# enable the Vertex AI Model API, and verify the connection.

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   Google Cloud Model API & Gemini: ADC setup script (Windows)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# --- Step 1: Locate or Install gcloud ---
Write-Host "`n--- Checking gcloud CLI installation ---" -ForegroundColor Cyan
$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
$gcloudPath = ""

if ($gcloudCmd) {
    $gcloudPath = $gcloudCmd.Source
    Write-Host "✅ gcloud CLI detected in PATH at: $gcloudPath" -ForegroundColor Green
} else {
    # Search common installation directories on Windows
    $commonPaths = @(
        "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "$env:ProgramFiles (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "$env:LocalAppData\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $gcloudPath = $path
            Write-Host "✅ gcloud CLI detected at: $gcloudPath" -ForegroundColor Green
            break
        }
    }
}

if (-not $gcloudPath) {
    Write-Host "⬇️  gcloud CLI not found. Attempting installation via winget..." -ForegroundColor Yellow
    try {
        # Check if winget is available
        $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
        if ($wingetCmd) {
            Write-Host "Running: winget install Google.CloudSDK ..." -ForegroundColor Cyan
            # Use winget to install Google Cloud SDK
            Start-Process winget -ArgumentList "install --id Google.CloudSDK --source winget --exact --accept-package-agreements --accept-source-agreements" -NoNewWindow -Wait
            
            # Recheck after winget installation
            foreach ($path in $commonPaths) {
                if (Test-Path $path) {
                    $gcloudPath = $path
                    Write-Host "✅ gcloud CLI successfully installed and detected at: $gcloudPath" -ForegroundColor Green
                    break
                }
            }
        }
    } catch {
        Write-Host "⚠️  winget installation failed or was cancelled." -ForegroundColor Yellow
    }
}

if (-not $gcloudPath) {
    Write-Host "⬇️  gcloud CLI still not detected. Downloading Google Cloud SDK Installer..." -ForegroundColor Yellow
    $installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"
    try {
        $client = New-Object System.Net.WebClient
        Write-Host "Downloading Google Cloud SDK Installer to $installerPath..." -ForegroundColor Cyan
        $client.DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", $installerPath)
        
        Write-Host "Launching Google Cloud SDK Installer. Please complete the setup wizard..." -ForegroundColor Cyan
        Write-Host "IMPORTANT: Once the installer completes, please open a new PowerShell terminal and re-run this script so the new environment variables are loaded." -ForegroundColor Yellow
        Start-Process -FilePath $installerPath -Wait
        
        Write-Host "Please restart your PowerShell window and run the script again." -ForegroundColor Green
        exit 0
    } catch {
        Write-Host "❌ Critical Error: Failed to download or install gcloud CLI." -ForegroundColor Red
        Write-Host "Please manually download and install Google Cloud CLI from:" -ForegroundColor Red
        Write-Host "https://cloud.google.com/sdk/docs/install#windows" -ForegroundColor Red
        exit 1
    }
}

# --- Step 2: Project Configuration ---
Write-Host "`n--- Project Setup ---" -ForegroundColor Cyan
$projectId = Read-Host "Enter your Google Cloud Project ID (NOT the name)"
$projectId = $projectId.Trim()

if ([string]::IsNullOrWhiteSpace($projectId)) {
    Write-Host "❌ Project ID cannot be empty." -ForegroundColor Red
    exit 1
}

# --- Step 3: Authentication ---
Write-Host "`n--- Authenticating ---" -ForegroundColor Cyan
Write-Host "Authorizing Application Default Credentials (ADC)..." -ForegroundColor Cyan
Write-Host "This will open a browser window for you to sign in." -ForegroundColor Yellow

# Execute 'gcloud auth application-default login'
& $gcloudPath auth application-default login

Write-Host "`nSetting active gcloud account..." -ForegroundColor Cyan
# Try to get active account
$account = & $gcloudPath auth list --filter=status:ACTIVE --format="value(account)"
if ($account) {
    & $gcloudPath config set account $account
    Write-Host "✅ Active account set to $account" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not determine active account from ADC login. You might be prompted to login again." -ForegroundColor Yellow
    Write-Host "Logging in to CLI..." -ForegroundColor Cyan
    & $gcloudPath auth login
}

# --- Step 4: Final Configuration ---
Write-Host "`n--- Finalizing Configuration ---" -ForegroundColor Cyan
& $gcloudPath config set project $projectId
& $gcloudPath auth application-default set-quota-project $projectId

# Try to enable the API
Write-Host "🔌 Ensuring Google Cloud Model API (aiplatform.googleapis.com) is enabled..." -ForegroundColor Cyan
try {
    & $gcloudPath services enable aiplatform.googleapis.com
    Write-Host "✅ Google Cloud Model API is enabled." -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not enable API (you might need an administrator to do this). Proceeding..." -ForegroundColor Yellow
}

# --- Step 5: Instant Verification ---
Write-Host "`n--- Verifying Access ---" -ForegroundColor Cyan
$accessToken = & $gcloudPath auth print-access-token
$accessToken = $accessToken.Trim()

if (-not $accessToken) {
    Write-Host "❌ Authentication failed. No token received." -ForegroundColor Red
    exit 1
}

Write-Host "Sending test prompt to Gemini Model API on Vertex AI..." -ForegroundColor Cyan

$uri = "https://aiplatform.googleapis.com/v1/projects/$projectId/locations/global/publishers/google/models/gemini-2.5-flash:generateContent"
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

$body = @{
    "contents" = @(
        @{
            "role" = "user"
            "parts" = @(
                @{ "text" = "Reply ONLY with the word SUCCESS" }
            )
        }
    )
} | ConvertTo-Json -Depth 5

try {
    # Send web request (ignoring SSL check just in case, but standard Invoke-RestMethod is preferred)
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop
    $responseText = $response.candidates[0].content.parts[0].text
    
    if ($responseText -like "*SUCCESS*") {
        Write-Host "`n🎉 SUCCESS! Your Model API access is fully working." -ForegroundColor Green
        Write-Host "ADC Credentials stored at: $env:APPDATA\gcloud\application_default_credentials.json" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Authentication worked, but the API call returned an unexpected response." -ForegroundColor Yellow
        Write-Host "Server Response: $responseText" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n⚠️  Authentication worked, but the API call failed." -ForegroundColor Red
    Write-Host "Error Details: $_" -ForegroundColor Red
}
