import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

// Stylish Excel export
export const exportAllViewsToExcel = async (institutionName: string, assignments: any[], workingDays: string[], timeSlots: any[]) => {
  const wb = new ExcelJS.Workbook();
  const periods = timeSlots.map((s: any, i: number) => ({ period: i + 1, ...s }));
  const headers = ['Period', ...workingDays];

  const buildSheet = (sheetName: string, entityList: string[], type: 'Class' | 'Faculty' | 'Room') => {
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    
    // Set column widths
    ws.columns = [
      { width: 14 },
      ...workingDays.map(() => ({ width: 22 }))
    ];

    entityList.forEach(entity => {
      // Title Row
      const titleRow = ws.addRow([`${type}: ${entity}`]);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Merge title across all columns
      ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark slate

      // Header Row
      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Lighter slate
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      // Data Rows
      periods.forEach(p => {
        const rowData = [`P${p.period}\n(${p.start}-${p.end})`];
        workingDays.forEach(d => {
          let a;
          if (type === 'Class') a = assignments.find(x => x.class_name === entity && x.day === d && x.period === p.period);
          else if (type === 'Faculty') a = assignments.find(x => x.teacher_name === entity && x.day === d && x.period === p.period);
          else if (type === 'Room') a = assignments.find(x => x.room_name === entity && x.day === d && x.period === p.period);

          if (a) {
            if (type === 'Class') rowData.push(`${a.subject_code}\n${a.teacher_name}\n${a.room_name}`);
            else if (type === 'Faculty') rowData.push(`${a.subject_code}\n${a.class_name}\n${a.room_name}`);
            else rowData.push(`${a.subject_code}\n${a.class_name}\n${a.teacher_name}`);
          } else {
            rowData.push('-');
          }
        });
        
        const dataRow = ws.addRow(rowData);
        dataRow.height = 48; // Taller rows for multi-line
        
        dataRow.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
          
          if (colNumber === 1) {
             cell.font = { bold: true, color: { argb: 'FF334155' } };
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Light gray for period col
          } else if (cell.value !== '-') {
             // Colored blocks for actual classes
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; // Light blue
             cell.font = { color: { argb: 'FF1D4ED8' }, bold: true }; // Blue text
          } else {
             cell.font = { color: { argb: 'FF94A3B8' } }; // Muted dash
          }
        });
      });
      
      ws.addRow([]); // Blank row spacer
    });
  };

  const classes = [...new Set(assignments.map(a => a.class_name))].sort() as string[];
  buildSheet('Class View', classes, 'Class');

  const faculty = [...new Set(assignments.map(a => a.teacher_name))].sort() as string[];
  buildSheet('Faculty View', faculty, 'Faculty');

  const rooms = [...new Set(assignments.map(a => a.room_name))].sort() as string[];
  buildSheet('Room View', rooms, 'Room');

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `${institutionName.replace(/ /g, '_')}_Timetables.xlsx`;
  saveAs(blob, fileName);
};

// PDF generation per view
export const generatePDFBlob = (title: string, entityList: string[], type: 'Class' | 'Faculty' | 'Room', assignments: any[], workingDays: string[], timeSlots: any[]) => {
  const doc = new jsPDF('landscape');
  const periods = timeSlots.map((s: any, i: number) => ({ period: i + 1, ...s }));
  const headers = ['Period', ...workingDays];

  entityList.forEach((entity, index) => {
    if (index > 0) doc.addPage();
    doc.setFontSize(16);
    doc.text(`${type}: ${entity}`, 14, 15);
    
    const body: any[][] = [];
    periods.forEach(p => {
      const row = [`P${p.period}\n${p.start}-${p.end}`];
      workingDays.forEach(d => {
        let a;
        if (type === 'Class') a = assignments.find(x => x.class_name === entity && x.day === d && x.period === p.period);
        else if (type === 'Faculty') a = assignments.find(x => x.teacher_name === entity && x.day === d && x.period === p.period);
        else if (type === 'Room') a = assignments.find(x => x.room_name === entity && x.day === d && x.period === p.period);
        
        if (a) {
           if (type === 'Class') row.push(`${a.subject_code}\n${a.teacher_name}\n${a.room_name}`);
           else if (type === 'Faculty') row.push(`${a.subject_code}\n${a.class_name}\n${a.room_name}`);
           else row.push(`${a.subject_code}\n${a.class_name}\n${a.teacher_name}`);
        } else {
           row.push('-');
        }
      });
      body.push(row);
    });

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 23, 42] }
    });
  });
  
  return doc.output('blob');
};

export const exportSelectedPDFs = async (institutionName: string, selections: any, assignments: any[], workingDays: string[], timeSlots: any[]) => {
  const blobs: { name: string, blob: Blob }[] = [];
  
  if (selections.class) {
    const classes = [...new Set(assignments.map(a => a.class_name))].sort() as string[];
    blobs.push({ name: 'Class_Timetables.pdf', blob: generatePDFBlob(institutionName, classes, 'Class', assignments, workingDays, timeSlots) });
  }
  if (selections.faculty) {
    const faculty = [...new Set(assignments.map(a => a.teacher_name))].sort() as string[];
    blobs.push({ name: 'Faculty_Timetables.pdf', blob: generatePDFBlob(institutionName, faculty, 'Faculty', assignments, workingDays, timeSlots) });
  }
  if (selections.room) {
    const rooms = [...new Set(assignments.map(a => a.room_name))].sort() as string[];
    blobs.push({ name: 'Room_Timetables.pdf', blob: generatePDFBlob(institutionName, rooms, 'Room', assignments, workingDays, timeSlots) });
  }
  if (selections.student) {
    const classes = [...new Set(assignments.map(a => a.class_name))].sort() as string[];
    blobs.push({ name: 'Student_Timetables.pdf', blob: generatePDFBlob(institutionName, classes, 'Class', assignments, workingDays, timeSlots) }); // same as class
  }

  if (blobs.length === 1) {
    saveAs(blobs[0].blob, `${institutionName.replace(/ /g, '_')}_${blobs[0].name}`);
  } else if (blobs.length > 1) {
    const zip = new JSZip();
    blobs.forEach(b => zip.file(b.name, b.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${institutionName.replace(/ /g, '_')}_Timetables.zip`);
  }
};
