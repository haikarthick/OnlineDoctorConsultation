# VetCare Consultation Diagrams Export Script
# This script helps export Mermaid diagrams to various formats

param(
    [string]$Format = "PNG",
    [string]$OutputDir = ".\exports",
    [switch]$AllDiagrams,
    [switch]$Help
)

if ($Help) {
    Write-Host "VetCare Consultation Diagrams Export Script"
    Write-Host ""
    Write-Host "Usage: .\export-diagrams.ps1 [-Format PNG|SVG|PDF] [-OutputDir path] [-AllDiagrams] [-Help]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -Format      Output format: PNG (default), SVG, or PDF"
    Write-Host "  -OutputDir   Output directory (default: .\exports)"
    Write-Host "  -AllDiagrams Export all diagrams"
    Write-Host "  -Help        Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\export-diagrams.ps1 -AllDiagrams"
    Write-Host "  .\export-diagrams.ps1 -Format SVG -OutputDir 'C:\My Documents'"
    exit
}

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$diagrams = @(
    @{
        Name = "PetOwnerConsultationWorkflow"
        Title = "Pet Owner Consultation Booking and Management Workflow"
        File = "consultation-workflow-diagrams.md"
        Index = 1
    },
    @{
        Name = "VeterinarianManagementWorkflow"
        Title = "Veterinarian Consultation Management Workflow"
        File = "consultation-workflow-diagrams.md"
        Index = 2
    },
    @{
        Name = "VideoConsultationTechnicalFlow"
        Title = "Video Consultation Session Technical Flow"
        File = "consultation-workflow-diagrams.md"
        Index = 3
    },
    @{
        Name = "ConsultationStatusTransitions"
        Title = "Consultation Status State Transitions"
        File = "consultation-workflow-diagrams.md"
        Index = 4
    },
    @{
        Name = "FarmerEnterpriseWorkflow"
        Title = "Farmer Enterprise Consultation Workflow"
        File = "consultation-workflow-diagrams.md"
        Index = 5
    },
    @{
        Name = "AdminOversightWorkflow"
        Title = "Admin Consultation Oversight Workflow"
        File = "consultation-workflow-diagrams.md"
        Index = 6
    },
    @{
        Name = "BookingDeduplicationWorkflow"
        Title = "Booking Creation and Deduplication Workflow"
        File = "consultation-workflow-diagrams.md"
        Index = 7
    },
    @{
        Name = "ArchitectureDataFlow"
        Title = "Consultation Module Architecture and Data Flow"
        File = "consultation-workflow-diagrams.md"
        Index = 8
    },
    @{
        Name = "SessionSequenceDiagram"
        Title = "Consultation Session Sequence Diagram"
        File = "consultation-workflow-diagrams.md"
        Index = 9
    }
)

Write-Host "VetCare Consultation Diagrams Export Tool"
Write-Host "=========================================="
Write-Host ""

if ($AllDiagrams) {
    Write-Host "Exporting all diagrams to $Format format..."
    Write-Host ""

    foreach ($diagram in $diagrams) {
        Write-Host "Processing: $($diagram.Title)"

        $outputFile = Join-Path $OutputDir "$($diagram.Name).$($Format.ToLower())"

        # Note: This is a placeholder for actual export logic
        # In a real implementation, you would use tools like:
        # - mermaid-cli for command line conversion
        # - Puppeteer for browser-based rendering
        # - Online APIs for conversion

        Write-Host "  -> Would export to: $outputFile"
        Write-Host "  -> Status: Placeholder (implement actual export logic)"
        Write-Host ""
    }

    Write-Host "Export complete!"
    Write-Host ""
    Write-Host "Note: This script contains placeholder export logic."
    Write-Host "To implement actual diagram export, you can use:"
    Write-Host "1. mermaid-cli npm package"
    Write-Host "2. Online tools like mermaid.ink"
    Write-Host "3. Draw.io import feature"
    Write-Host "4. VS Code extensions with export capabilities"

} else {
    Write-Host "Available diagrams:"
    for ($i = 0; $i -lt $diagrams.Count; $i++) {
        Write-Host "  $($i + 1). $($diagrams[$i].Title)"
    }
    Write-Host ""
    Write-Host "Use -AllDiagrams to export all diagrams"
    Write-Host "Use -Help for more information"
}

Write-Host ""
Write-Host "Manual Export Instructions:"
Write-Host "=========================="
Write-Host ""
Write-Host "Method 1 - Online Tools:"
Write-Host "1. Copy Mermaid code from consultation-workflow-diagrams.md"
Write-Host "2. Go to https://mermaid.live or https://mermaid.ink"
Write-Host "3. Paste the code and export as PNG/SVG/PDF"
Write-Host ""
Write-Host "Method 2 - Draw.io:"
Write-Host "1. Open https://app.diagrams.net"
Write-Host "2. File -> Import -> Mermaid..."
Write-Host "3. Paste Mermaid code and import"
Write-Host "4. Export as desired format"
Write-Host ""
Write-Host "Method 3 - VS Code Extensions:"
Write-Host "1. Install 'Mermaid Preview' or 'Markdown Preview Mermaid Support'"
Write-Host "2. Open the .md file and use export features"
Write-Host ""
Write-Host "Method 4 - Command Line (requires Node.js):"
Write-Host "  npm install -g @mermaid-js/mermaid-cli"
Write-Host "  mmdc -i diagram.mmd -o diagram.png"