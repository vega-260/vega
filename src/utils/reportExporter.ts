import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ReportData {
  reportTitle: string;
  reportCategory: string;
  reportType: string;
  generatedAt: string;
  collegeName: string;
  appliedFilters?: {
    batch?: string;
    department?: string;
    placementStatus?: string;
    minScoreCutoff?: string;
  };
  summaryMetrics?: {
    totalStudents?: number;
    placedStudents?: number;
    unplacedStudents?: number;
    placementRate?: string;
    avgAssessmentScore?: string;
    topPackage?: string;
  };
  testSummary?: {
    title: string;
    category: string;
    durationMinutes: number;
    passPercentage: number;
    totalSubmissions: number;
    passedCount: number;
    failedCount: number;
    avgScore: number;
    passRate: number;
  };
  studentProfile?: {
    fullName: string;
    rollNumber: string;
    email: string;
    phone: string;
    department: string;
    batchName: string;
    cgpa: string;
    backlogs: number;
    talentScore: number;
    assessmentAvg: number;
    placementStatus: string;
    company: string;
    packageOffered: string;
    skillBreakdown: {
      aptitude: number;
      technical: number;
      communication: number;
      softskills: number;
    };
  };
  testHistory?: Array<{
    title: string;
    category: string;
    score: number;
    date: string;
  }>;
  placementApplications?: Array<{
    company: string;
    role: string;
    package: string;
    status: string;
    date: string;
  }>;
  studentResults?: Array<{
    rank: number;
    fullName: string;
    rollNumber: string;
    email: string;
    department: string;
    batchName: string;
    score: number;
    timeTakenMinutes: number;
    status: string;
    submittedAt: string;
  }>;
  studentRoster?: Array<{
    id: number;
    fullName: string;
    rollNumber: string;
    email: string;
    department: string;
    batchName: string;
    cgpa: string;
    assessmentAvg: number;
    placementStatus: string;
    company: string;
    packageOffered: string;
  }>;
  batchBreakdown?: Array<{
    batchName: string;
    totalStudents: number;
    placedStudents: number;
    unplacedStudents: number;
    placementRate: string;
    avgAssessmentScore: string;
    topCompany: string;
  }>;
  departmentBreakdown?: Array<{
    department: string;
    totalStudents: number;
    placedStudents: number;
    unplacedStudents: number;
    placementRate: string;
    avgAssessmentScore: string;
    topPackage: string;
  }>;
  recruiterBreakdown?: Array<{
    companyName: string;
    offersGiven: number;
    avgPackage: string;
    highestPackage: string;
    hiredStudentsCount: number;
    studentNamesSample: string;
  }>;
  skillGapMatrix?: Array<{
    skillCategory: string;
    avgScore: string;
    benchmark: string;
    gapPercentage: string;
    readinessLevel: string;
    recommendedAction: string;
  }>;
  eligibilityList?: Array<{
    rank: number;
    fullName: string;
    rollNumber: string;
    department: string;
    batchName: string;
    assessmentAvg: string;
    eligibilityStatus: string;
    remark: string;
  }>;
  placementSummaryList?: Array<{
    rank: number;
    fullName: string;
    rollNumber: string;
    department: string;
    batchName: string;
    placementStatus: string;
    company: string;
    packageOffered: string;
  }>;
  categoryScores?: Array<{
    category: string;
    avgScore: number;
    attempts: number;
  }>;
}

export function exportToExcel(data: ReportData) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Metadata & Summary
  const summaryRows: any[] = [
    { Property: "Report Title", Value: data.reportTitle },
    { Property: "Institution", Value: data.collegeName },
    { Property: "Generated Date", Value: new Date(data.generatedAt).toLocaleString('en-IN') },
    { Property: "Report Category", Value: data.reportCategory },
    { Property: "Report Type", Value: data.reportType },
    {}
  ];

  if (data.appliedFilters) {
    summaryRows.push(
      { Property: "-- APPLIED FILTERS --", Value: "" },
      { Property: "Batch Filter", Value: data.appliedFilters.batch || "ALL" },
      { Property: "Department Filter", Value: data.appliedFilters.department || "ALL" },
      { Property: "Placement Status", Value: data.appliedFilters.placementStatus || "ALL" },
      { Property: "Min Cutoff Score", Value: data.appliedFilters.minScoreCutoff || "None" },
      {}
    );
  }

  if (data.summaryMetrics) {
    summaryRows.push(
      { Property: "-- SUMMARY METRICS --", Value: "" },
      { Property: "Total Students", Value: data.summaryMetrics.totalStudents },
      { Property: "Placed Students", Value: data.summaryMetrics.placedStudents },
      { Property: "Placement Rate", Value: data.summaryMetrics.placementRate },
      { Property: "Avg Assessment Score", Value: data.summaryMetrics.avgAssessmentScore },
      { Property: "Top Package", Value: data.summaryMetrics.topPackage }
    );
  } else if (data.testSummary) {
    summaryRows.push(
      { Property: "-- TEST SUMMARY --", Value: "" },
      { Property: "Test Title", Value: data.testSummary.title },
      { Property: "Category", Value: data.testSummary.category },
      { Property: "Total Submissions", Value: data.testSummary.totalSubmissions },
      { Property: "Passed Count", Value: data.testSummary.passedCount },
      { Property: "Pass Rate", Value: `${data.testSummary.passRate}%` },
      { Property: "Average Score", Value: `${data.testSummary.avgScore}%` }
    );
  } else if (data.studentProfile) {
    const sp = data.studentProfile;
    summaryRows.push(
      { Property: "-- STUDENT DOSSIER --", Value: "" },
      { Property: "Full Name", Value: sp.fullName },
      { Property: "Roll Number", Value: sp.rollNumber },
      { Property: "Department", Value: sp.department },
      { Property: "Batch", Value: sp.batchName },
      { Property: "Email", Value: sp.email },
      { Property: "Phone", Value: sp.phone },
      { Property: "CGPA", Value: sp.cgpa },
      { Property: "Placement Status", Value: sp.placementStatus },
      { Property: "Placed Company", Value: sp.company },
      { Property: "Package", Value: sp.packageOffered },
      { Property: "Talent Score", Value: `${sp.talentScore}%` }
    );
  }

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Sheet 2: Main Data Table
  let mainTableData: any[] = [];
  if (data.batchBreakdown && data.batchBreakdown.length > 0) {
    mainTableData = data.batchBreakdown.map((b, idx) => ({
      "S.No": idx + 1,
      "Batch Name": b.batchName,
      "Total Students": b.totalStudents,
      "Placed Students": b.placedStudents,
      "Unplaced Students": b.unplacedStudents,
      "Placement Rate": b.placementRate,
      "Avg Assessment Score": b.avgAssessmentScore,
      "Top Recruiter": b.topCompany
    }));
  } else if (data.departmentBreakdown && data.departmentBreakdown.length > 0) {
    mainTableData = data.departmentBreakdown.map((d, idx) => ({
      "S.No": idx + 1,
      "Department": d.department,
      "Total Students": d.totalStudents,
      "Placed Students": d.placedStudents,
      "Unplaced Students": d.unplacedStudents,
      "Placement Rate": d.placementRate,
      "Avg Score": d.avgAssessmentScore,
      "Top Package": d.topPackage
    }));
  } else if (data.recruiterBreakdown && data.recruiterBreakdown.length > 0) {
    mainTableData = data.recruiterBreakdown.map((r, idx) => ({
      "S.No": idx + 1,
      "Company Name": r.companyName,
      "Offers Issued": r.offersGiven,
      "Average Package": r.avgPackage,
      "Highest Package": r.highestPackage,
      "Placed Students": r.studentNamesSample
    }));
  } else if (data.skillGapMatrix && data.skillGapMatrix.length > 0) {
    mainTableData = data.skillGapMatrix.map((sg, idx) => ({
      "S.No": idx + 1,
      "Skill Category": sg.skillCategory,
      "Student Avg Score": sg.avgScore,
      "Industry Benchmark": sg.benchmark,
      "Skill Gap %": sg.gapPercentage,
      "Readiness Status": sg.readinessLevel,
      "Recommended Action": sg.recommendedAction
    }));
  } else if (data.eligibilityList && data.eligibilityList.length > 0) {
    mainTableData = data.eligibilityList.map(e => ({
      "Rank": e.rank,
      "Student Name": e.fullName,
      "Roll Number": e.rollNumber,
      "Department": e.department,
      "Batch": e.batchName,
      "Score (%)": e.assessmentAvg,
      "Eligibility Status": e.eligibilityStatus,
      "Remarks": e.remark
    }));
  } else if (data.studentResults && data.studentResults.length > 0) {
    mainTableData = data.studentResults.map(s => ({
      "Rank": s.rank,
      "Student Name": s.fullName,
      "Roll Number": s.rollNumber,
      "Email": s.email,
      "Department": s.department,
      "Batch": s.batchName,
      "Score (%)": s.score,
      "Time Spent (mins)": s.timeTakenMinutes,
      "Result": s.status,
      "Submitted Date": s.submittedAt
    }));
  } else if (data.placementSummaryList && data.placementSummaryList.length > 0) {
    mainTableData = data.placementSummaryList.map(p => ({
      "Rank": p.rank,
      "Student Name": p.fullName,
      "Roll Number": p.rollNumber,
      "Department": p.department,
      "Batch": p.batchName,
      "Placement Status": p.placementStatus,
      "Company": p.company,
      "Package Offered": p.packageOffered
    }));
  } else if (data.studentRoster && data.studentRoster.length > 0) {
    mainTableData = data.studentRoster.map((s, idx) => ({
      "S.No": idx + 1,
      "Student Name": s.fullName,
      "Roll Number": s.rollNumber,
      "Email": s.email,
      "Department": s.department,
      "Batch": s.batchName,
      "CGPA": s.cgpa,
      "Assessment Score (%)": s.assessmentAvg,
      "Placement Status": s.placementStatus,
      "Company": s.company,
      "Package Offered": s.packageOffered
    }));
  } else if (data.testHistory && data.testHistory.length > 0) {
    mainTableData = data.testHistory.map((t, idx) => ({
      "S.No": idx + 1,
      "Test Title": t.title,
      "Category": t.category,
      "Score (%)": t.score,
      "Completed Date": t.date
    }));
  }

  if (mainTableData.length > 0) {
    const wsDetails = XLSX.utils.json_to_sheet(mainTableData);
    XLSX.utils.book_append_sheet(wb, wsDetails, "Report Records");
  }

  const fileName = `${data.reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToCSV(data: ReportData) {
  let rows: any[] = [];

  if (data.studentResults && data.studentResults.length > 0) {
    rows = data.studentResults.map(s => ({
      "Rank": s.rank,
      "Name": s.fullName,
      "Roll Number": s.rollNumber,
      "Department": s.department,
      "Batch": s.batchName,
      "Score": `${s.score}%`,
      "Result": s.status,
      "Date": s.submittedAt
    }));
  } else if (data.studentRoster && data.studentRoster.length > 0) {
    rows = data.studentRoster.map((s, i) => ({
      "S.No": i + 1,
      "Name": s.fullName,
      "Roll Number": s.rollNumber,
      "Department": s.department,
      "Batch": s.batchName,
      "Score": `${s.assessmentAvg}%`,
      "Placement Status": s.placementStatus,
      "Company": s.company,
      "Package": s.packageOffered
    }));
  } else if (data.studentProfile) {
    const sp = data.studentProfile;
    rows = [{
      "Name": sp.fullName,
      "Roll Number": sp.rollNumber,
      "Email": sp.email,
      "Department": sp.department,
      "Batch": sp.batchName,
      "CGPA": sp.cgpa,
      "Talent Score": `${sp.talentScore}%`,
      "Placement Status": sp.placementStatus,
      "Company": sp.company,
      "Package": sp.packageOffered
    }];
  }

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${data.reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(data: ReportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  // Header Banner
  doc.setFillColor(30, 41, 59); // dark slate #1E293B
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VEGA CAREER & PLACEMENT ENGINE', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.collegeName.toUpperCase(), 14, 18);

  doc.text(`Official TPO Report • Generated ${new Date(data.generatedAt).toLocaleDateString('en-IN')}`, pageWidth - 14, 15, { align: 'right' });

  currentY = 32;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.reportTitle, 14, currentY);
  currentY += 8;

  // Filter Bar if exists
  if (data.appliedFilters) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, pageWidth - 28, 12, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const filterTxt = `Filters: Batch: ${data.appliedFilters.batch || 'ALL'} | Department: ${data.appliedFilters.department || 'ALL'} | Status: ${data.appliedFilters.placementStatus || 'ALL'} | Min Score: ${data.appliedFilters.minScoreCutoff || 'None'}`;
    doc.text(filterTxt, 18, currentY + 7.5);
    currentY += 18;
  }

  // Summary Stat Cards
  if (data.summaryMetrics) {
    const sm = data.summaryMetrics;
    const cardW = (pageWidth - 28 - 9) / 4;
    const cards = [
      { label: 'Total Students', val: sm.totalStudents ?? 0 },
      { label: 'Placed Students', val: sm.placedStudents ?? 0 },
      { label: 'Placement Rate', val: sm.placementRate ?? '0%' },
      { label: 'Avg Score', val: sm.avgAssessmentScore ?? '0%' }
    ];

    cards.forEach((c, idx) => {
      const x = 14 + idx * (cardW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardW, 16, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(c.label.toUpperCase(), x + 4, currentY + 5);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(String(c.val), x + 4, currentY + 12);
    });

    currentY += 22;
  } else if (data.testSummary) {
    const ts = data.testSummary;
    const cardW = (pageWidth - 28 - 9) / 4;
    const cards = [
      { label: 'Submissions', val: ts.totalSubmissions },
      { label: 'Passed Students', val: ts.passedCount },
      { label: 'Pass Rate', val: `${ts.passRate}%` },
      { label: 'Average Score', val: `${ts.avgScore}%` }
    ];

    cards.forEach((c, idx) => {
      const x = 14 + idx * (cardW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardW, 16, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(c.label.toUpperCase(), x + 4, currentY + 5);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(String(c.val), x + 4, currentY + 12);
    });

    currentY += 22;
  } else if (data.studentProfile) {
    const sp = data.studentProfile;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Student: ${sp.fullName} (${sp.rollNumber})`, 18, currentY + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Dept: ${sp.department} | Batch: ${sp.batchName} | Email: ${sp.email}`, 18, currentY + 12);
    doc.text(`Placement: ${sp.placementStatus} (${sp.company} - ${sp.packageOffered}) | Talent Readiness: ${sp.talentScore}%`, 18, currentY + 18);
    doc.text(`Skill Breakdown: Aptitude ${sp.skillBreakdown.aptitude}% • Coding ${sp.skillBreakdown.technical}% • Comm ${sp.skillBreakdown.communication}%`, 18, currentY + 23);

    currentY += 32;
  }

  // Draw Data Table
  let headers: string[] = [];
  let rows: string[][] = [];

  if (data.batchBreakdown && data.batchBreakdown.length > 0) {
    headers = ['S.No', 'Batch Name', 'Total', 'Placed', 'Rate', 'Avg Score', 'Top Recruiter'];
    rows = data.batchBreakdown.map((b, i) => [
      String(i + 1),
      b.batchName,
      String(b.totalStudents),
      String(b.placedStudents),
      b.placementRate,
      b.avgAssessmentScore,
      b.topCompany
    ]);
  } else if (data.departmentBreakdown && data.departmentBreakdown.length > 0) {
    headers = ['S.No', 'Department', 'Total', 'Placed', 'Rate', 'Avg Score', 'Top Package'];
    rows = data.departmentBreakdown.map((d, i) => [
      String(i + 1),
      d.department,
      String(d.totalStudents),
      String(d.placedStudents),
      d.placementRate,
      d.avgAssessmentScore,
      d.topPackage
    ]);
  } else if (data.recruiterBreakdown && data.recruiterBreakdown.length > 0) {
    headers = ['S.No', 'Company Name', 'Offers', 'Avg Pkg', 'Top Pkg', 'Selected Candidates'];
    rows = data.recruiterBreakdown.map((r, i) => [
      String(i + 1),
      r.companyName,
      String(r.offersGiven),
      r.avgPackage,
      r.highestPackage,
      r.studentNamesSample
    ]);
  } else if (data.skillGapMatrix && data.skillGapMatrix.length > 0) {
    headers = ['S.No', 'Skill Category', 'Score', 'Benchmark', 'Gap', 'Readiness Status'];
    rows = data.skillGapMatrix.map((sg, i) => [
      String(i + 1),
      sg.skillCategory,
      sg.avgScore,
      sg.benchmark,
      sg.gapPercentage,
      sg.readinessLevel
    ]);
  } else if (data.eligibilityList && data.eligibilityList.length > 0) {
    headers = ['Rank', 'Student Name', 'Roll No', 'Dept', 'Batch', 'Score', 'Status'];
    rows = data.eligibilityList.map((e) => [
      `#${e.rank}`,
      e.fullName,
      e.rollNumber,
      e.department,
      e.batchName,
      e.assessmentAvg,
      e.eligibilityStatus
    ]);
  } else if (data.studentResults && data.studentResults.length > 0) {
    headers = ['Rank', 'Student Name', 'Roll No', 'Dept', 'Batch', 'Score', 'Status'];
    rows = data.studentResults.map(s => [
      `#${s.rank}`,
      s.fullName,
      s.rollNumber,
      s.department,
      s.batchName,
      `${s.score}%`,
      s.status
    ]);
  } else if (data.studentRoster && data.studentRoster.length > 0) {
    headers = ['S.No', 'Student Name', 'Roll No', 'Dept', 'Batch', 'Score', 'Placement', 'Company'];
    rows = data.studentRoster.map((s, i) => [
      String(i + 1),
      s.fullName,
      s.rollNumber,
      s.department,
      s.batchName,
      `${s.assessmentAvg}%`,
      s.placementStatus,
      s.company
    ]);
  } else if (data.testHistory && data.testHistory.length > 0) {
    headers = ['S.No', 'Test Title', 'Category', 'Score', 'Date'];
    rows = data.testHistory.map((t, i) => [
      String(i + 1),
      t.title,
      t.category,
      `${t.score}%`,
      t.date
    ]);
  }

  if (headers.length > 0 && rows.length > 0) {
    const colWidths = (pageWidth - 28) / headers.length;

    // Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(14, currentY, pageWidth - 28, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    headers.forEach((h, i) => {
      doc.text(h, 16 + i * colWidths, currentY + 5.5);
    });

    currentY += 8;

    // Rows
    rows.forEach((r, rIdx) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;

        // Re-draw table header on new page
        doc.setFillColor(30, 41, 59);
        doc.rect(14, currentY, pageWidth - 28, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        headers.forEach((h, i) => {
          doc.text(h, 16 + i * colWidths, currentY + 5.5);
        });
        currentY += 8;
      }

      if (rIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY, pageWidth - 28, 7, 'F');
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      r.forEach((cell, cIdx) => {
        const truncated = cell.length > 22 ? cell.substring(0, 20) + '..' : cell;
        doc.text(truncated, 16 + cIdx * colWidths, currentY + 5);
      });

      currentY += 7;
    });
  }

  // Footer & Official Seal
  currentY = Math.min(currentY + 15, 275);
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, pageWidth - 14, currentY);

  currentY += 6;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text('This is an official system-generated placement report from VEGA TPO Platform.', 14, currentY);
  doc.text('Training & Placement Officer Signature / Stamp', pageWidth - 14, currentY, { align: 'right' });

  const fileName = `${data.reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
