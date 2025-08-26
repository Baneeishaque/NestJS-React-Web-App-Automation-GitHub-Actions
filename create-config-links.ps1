#!pwsh-preview

<#
.SYNOPSIS
    Creates symbolic links from .example files to actual configuration files

.DESCRIPTION
    This script finds all .example files in a reference folder and creates symbolic links
    to the corresponding actual configuration files located in a local configuration folder.

.PARAMETER ConfigFolder
    Path to the local configuration folder containing actual files (required)

.PARAMETER ReferenceFolder
    Path to search for .example files (defaults to current directory if not specified)

.PARAMETER DryRun
    Preview mode - shows what would be done without making changes

.EXAMPLE
    .\create-config-links.ps1 -ConfigFolder "C:\My\Config\Folder"

.EXAMPLE
    .\create-config-links.ps1 -ConfigFolder "/path/to/config" -ReferenceFolder "/path/to/search"

.EXAMPLE
    .\create-config-links.ps1 -ConfigFolder "/path/to/config" -DryRun
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ConfigFolder,

    [Parameter(Mandatory = $false)]
    [string]$ReferenceFolder = ".",

    [switch]$DryRun
)

# Ensure the script works with both Windows PowerShell and PowerShell Core
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "This script requires PowerShell 5.0 or higher"
    exit 1
}

# Validate configuration folder exists and is accessible
try {
    $configFolderInfo = Get-Item $ConfigFolder -ErrorAction Stop
    if (-not $configFolderInfo.PSIsContainer) {
        throw "Path exists but is not a directory"
    }
}
catch {
    Write-Error "❌ Configuration folder '$ConfigFolder' not found or not accessible: $_"
    exit 1
}

# Validate reference folder exists and is accessible
try {
    $referenceFolderInfo = Get-Item $ReferenceFolder -ErrorAction Stop
    if (-not $referenceFolderInfo.PSIsContainer) {
        throw "Path exists but is not a directory"
    }
}
catch {
    Write-Error "❌ Reference folder '$ReferenceFolder' not found or not accessible: $_"
    exit 1
}

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
}
Write-Host "Configuration folder found: $ConfigFolder" -ForegroundColor Green
Write-Host "🔍 Finding all .example files in reference folder: $ReferenceFolder" -ForegroundColor Cyan

# Get all .example files recursively (including hidden files)
# Using a more comprehensive approach to ensure we find all files
$exampleFiles = @()

# Method 1: Get-ChildItem with Force (catches most files)
$exampleFiles += Get-ChildItem -Path $ReferenceFolder -Filter "*.example" -File -Recurse -Force

# Method 2: Use Get-ChildItem with Include to catch any missed hidden files
$exampleFiles += Get-ChildItem -Path $ReferenceFolder -Include "*.example" -File -Recurse -Force

# Remove duplicates
$exampleFiles = $exampleFiles | Select-Object -Unique

foreach ($exampleFile in $exampleFiles) {
    # Get the relative path from reference folder
    $referenceFolderFullPath = Resolve-Path $ReferenceFolder
    $relativePath = $exampleFile.FullName.Substring($referenceFolderFullPath.Path.Length + 1)

    # Get the corresponding file path (without .example extension)
    $actualFileName = $exampleFile.Name -replace '\.example$', ''
    $actualFilePath = $exampleFile.DirectoryName + "\" + $actualFileName

    # Get the corresponding file in config folder (maintain relative structure)
    $configFileRelative = $relativePath -replace '\.example$', ''

    # Get the leaf folder name from ReferenceFolder path
    $referenceLeafFolder = Split-Path $ReferenceFolder -Leaf

    # Construct path: ConfigFolder/ReferenceLeafFolder/relativePath
    $configFilePath = Join-Path $ConfigFolder (Join-Path $referenceLeafFolder $configFileRelative)

    if (Test-Path $configFilePath -PathType Leaf) {
        Write-Host "✅ Found counterpart for $relativePath`: $configFilePath" -ForegroundColor Green

        # Check what action would be taken
        $actionNeeded = $false
        if (Test-Path $actualFilePath) {
            $existingItem = Get-Item $actualFilePath
            if ($existingItem.LinkType -ne "SymbolicLink" -or $existingItem.Target -ne $configFilePath) {
                $actionNeeded = $true
            }
        } else {
            $actionNeeded = $true
        }

        if ($actionNeeded) {
            if ($DryRun) {
                Write-Host "🔍 DRY RUN: Would create/update symbolic link: $actualFileName → $configFilePath" -ForegroundColor Cyan
            } else {
                # Remove existing file/link if it exists
                if (Test-Path $actualFilePath) {
                    Remove-Item $actualFilePath -Force
                }

                # Create directory if it doesn't exist
                $actualDir = Split-Path $actualFilePath -Parent
                if (-not (Test-Path $actualDir)) {
                    New-Item -ItemType Directory -Path $actualDir -Force | Out-Null
                }

                # Create symbolic link using cross-platform PowerShell method
                try {
                    New-Item -ItemType SymbolicLink -Path $actualFilePath -Target $configFilePath -Force -ErrorAction Stop | Out-Null
                    Write-Host "✅ Created symbolic link: $actualFileName → $configFilePath" -ForegroundColor Green
                }
                catch {
                    Write-Error "❌ Failed to create symbolic link for $relativePath`: $_"
                    Write-Error "💡 Ensure you have sufficient permissions and PowerShell supports symbolic links on this platform"
                    exit 1
                }
            }
        } else {
            Write-Host "ℹ️  Symbolic link already exists and is correct: $actualFileName → $configFilePath" -ForegroundColor Blue
        }
    }
    else {
        Write-Error "❌ Missing counterpart for $relativePath`: $configFilePath not found"
        Write-Error "🚨 Exiting due to missing configuration file"
        exit 1
    }
}

if ($DryRun) {
    Write-Host "🎉 DRY RUN completed - All .example files would be successfully linked to local configuration files" -ForegroundColor Magenta
} else {
    Write-Host "🎉 All .example files have been successfully linked to local configuration files" -ForegroundColor Magenta
}
