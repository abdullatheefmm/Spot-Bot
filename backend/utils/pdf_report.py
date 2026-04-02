from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, String
import base64
import io
import os
from datetime import datetime

SEVERITY_COLORS = {
    "Critical": colors.HexColor("#FF4444"),
    "Major": colors.HexColor("#FF8C00"),
    "Minor": colors.HexColor("#FFD700"),
    "None": colors.HexColor("#00C851"),
}

def generate_pdf_report(scan_data, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Title Style
    title_style = ParagraphStyle('Title', parent=styles['Title'],
                                  fontSize=24, textColor=colors.HexColor("#1a1a2e"),
                                  spaceAfter=6, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
                                     fontSize=12, textColor=colors.HexColor("#6c63ff"),
                                     spaceAfter=4, alignment=TA_CENTER)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'],
                                    fontSize=14, textColor=colors.HexColor("#1a1a2e"),
                                    spaceBefore=12, spaceAfter=6)
    normal_style = ParagraphStyle('Body', parent=styles['Normal'],
                                   fontSize=10, textColor=colors.HexColor("#333333"),
                                   spaceAfter=4, leading=14)

    # Header
    story.append(Paragraph("🤖 SpotBot", title_style))
    story.append(Paragraph("Autonomous PCB Defect Detection Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#6c63ff")))
    story.append(Spacer(1, 0.3*inch))

    # Scan Summary Table
    defects = scan_data.get("defects", [])
    severity = scan_data.get("severity", "None")
    board_status = scan_data.get("board_status", "OK")
    sev_color = SEVERITY_COLORS.get(severity, colors.green)
    status_color = colors.HexColor("#FF4444") if board_status == "FAULTY" else colors.HexColor("#00C851")

    story.append(Paragraph("Scan Summary", heading_style))
    summary_data = [
        ["Report ID", f"#{scan_data.get('id', 'N/A')}"],
        ["Scan Date", scan_data.get('timestamp', datetime.now().isoformat())[:19].replace('T', ' ')],
        ["Scan Type", scan_data.get('scan_type', 'upload').capitalize()],
        ["Total Defects Found", str(len(defects))],
        ["Overall Severity", severity],
        ["Board Status", board_status],
    ]
    summary_table = Table(summary_data, colWidths=[3*inch, 4*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f0f0ff")),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f9ff")]),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (1, 5), (1, 5), status_color),
        ('FONTNAME', (1, 5), (1, 5), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, 4), (1, 4), sev_color),
        ('FONTNAME', (1, 4), (1, 4), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.3*inch))

    # Defect Details
    if defects:
        story.append(Paragraph("Detected Defects", heading_style))
        for i, defect in enumerate(defects, 1):
            defect_type = defect.get("type", "Unknown")
            sev = defect.get("severity", "Minor")
            conf = defect.get("confidence", 0)
            desc = defect.get("description", "")
            repair = defect.get("repair", "")
            sev_c = SEVERITY_COLORS.get(sev, colors.green)

            defect_data = [
                [f"Defect #{i}: {defect_type}", f"Severity: {sev}", f"Confidence: {int(conf*100)}%"],
            ]
            defect_table = Table(defect_data, colWidths=[3.5*inch, 2*inch, 1.5*inch])
            defect_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('PADDING', (0, 0), (-1, -1), 8),
                ('TEXTCOLOR', (1, 0), (1, 0), sev_c),
            ]))
            story.append(defect_table)
            story.append(Paragraph(f"<b>Description:</b> {desc}", normal_style))
            story.append(Paragraph(f"<b>Repair Guide:</b> {repair}", normal_style))
            story.append(Spacer(1, 0.15*inch))
    else:
        story.append(Paragraph("✅ No defects detected. Board is in good condition!", normal_style))

    # Footer
    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Paragraph("Generated by SpotBot — Autonomous PCB Debugging System", 
                            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8,
                                           textColor=colors.grey, alignment=TA_CENTER)))

    doc.build(story)
    return output_path
