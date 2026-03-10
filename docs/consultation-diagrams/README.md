# VetCare Consultation Module Diagrams

This directory contains comprehensive functional workflow diagrams for the VetCare platform's consultation module, created through deep code analysis.

## Files in This Directory

- `consultation-workflow-diagrams.md` - All diagrams in Markdown format with Mermaid syntax
- `export-diagrams.ps1` - PowerShell script for batch export operations
- `README.md` - This documentation file

## Diagram Overview

### 1. Pet Owner Consultation Booking and Management Workflow
Complete journey from booking request to consultation completion and review.

### 2. Veterinarian Consultation Management Workflow
Doctor's perspective on managing consultation queue, confirmations, and medical assessments.

### 3. Video Consultation Session Technical Flow
Technical implementation of WebRTC connections, media streaming, and fallback mechanisms.

### 4. Consultation Status State Transitions
All possible status changes for bookings and consultations with valid transitions.

### 5. Farmer Enterprise Consultation Workflow
Farm/enterprise-level consultations with herd and group context.

### 6. Admin Consultation Oversight Workflow
Administrative monitoring, intervention, and system management capabilities.

### 7. Booking Creation and Deduplication Workflow
Complex deduplication logic and booking confirmation process.

### 8. Consultation Module Architecture and Data Flow
System components, API interactions, and database relationships.

### 9. Consultation Session Sequence Diagram
Complete interaction flow between all system components and users.

## Export Methods

### Method 1: Online Tools (Recommended)

#### Option A: Mermaid Live Editor
1. Go to https://mermaid.live/
2. Copy the Mermaid code from `consultation-workflow-diagrams.md`
3. Paste into the editor
4. Click "Download" and select PNG/SVG/PDF

#### Option B: Mermaid Ink
1. Go to https://mermaid.ink/
2. Copy the Mermaid code
3. Paste in the text area
4. Choose export format from the dropdown

### Method 2: Draw.io (for Word/PPT Integration)

1. Open https://app.diagrams.net (formerly draw.io)
2. Select "File" → "Import" → "Mermaid..."
3. Copy and paste the Mermaid code
4. Click "Import"
5. Edit/stylize as needed
6. Export as:
   - PNG/SVG for documents
   - VSDX for Visio
   - PDF for sharing

### Method 3: VS Code Extensions

#### Option A: Markdown Preview Mermaid Support
1. Install the extension "Markdown Preview Mermaid Support"
2. Open `consultation-workflow-diagrams.md`
3. Use Ctrl+Shift+V to preview
4. Right-click on diagrams to save as image

#### Option B: Mermaid Preview Extension
1. Install "Mermaid Preview" extension
2. Open command palette (Ctrl+Shift+P)
3. Run "Mermaid: Preview"
4. Export diagrams from the preview pane

### Method 4: Command Line Tools

#### Using mermaid-cli
```bash
# Install globally
npm install -g @mermaid-js/mermaid-cli

# Export individual diagram (requires extracting from markdown)
mmdc -i diagram.mmd -o diagram.png

# For all diagrams, you'd need to extract each mermaid block
```

#### Using Puppeteer (Advanced)
```javascript
// Requires Node.js setup
const puppeteer = require('puppeteer');
const fs = require('fs');

// Script to render Mermaid diagrams
```

### Method 5: PowerShell Script

Use the included `export-diagrams.ps1` script:

```powershell
# Export all diagrams to PNG
.\export-diagrams.ps1 -AllDiagrams

# Export to SVG format
.\export-diagrams.ps1 -AllDiagrams -Format SVG

# Export to custom directory
.\export-diagrams.ps1 -AllDiagrams -OutputDir "C:\My Documents\Diagrams"
```

## Integration with Documents

### Microsoft Word
1. Export diagrams as PNG or SVG
2. Insert → Pictures → Select exported image
3. Resize and position as needed
4. Add captions and references

### PowerPoint
1. Export as PNG/SVG
2. Insert → Pictures
3. Use for presentations and training materials

### Google Docs
1. Export as PNG
2. Insert → Image
3. Upload from computer

### Confluence/Other Wikis
1. Export as PNG/SVG
2. Upload as attachments
3. Embed in pages

## Tips for Professional Documentation

1. **Consistent Sizing**: Export all diagrams at similar resolutions (e.g., 1920x1080 or higher)
2. **File Naming**: Use descriptive names like `01-pet-owner-workflow.png`
3. **Metadata**: Add creation date and version information
4. **Backup**: Keep both source Mermaid code and exported images
5. **Version Control**: Store in git alongside the main codebase

## Technical Notes

- All diagrams use Mermaid syntax (flowchart, stateDiagram, sequenceDiagram)
- Diagrams are responsive and will scale appropriately
- Some complex diagrams may need manual layout adjustments in draw.io
- WebRTC and real-time aspects are represented conceptually

## Maintenance

When the codebase changes:
1. Update the Mermaid code in the markdown file
2. Re-export diagrams using preferred method
3. Update version numbers and dates
4. Archive old versions for reference

---

**Created:** March 10, 2026
**VetCare Platform Version:** v1.0
**Diagrams:** 9 comprehensive workflow diagrams
**Format:** Mermaid markdown with export instructions