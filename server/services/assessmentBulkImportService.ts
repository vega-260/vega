import Papa from "papaparse";

export interface BulkImportQuestion {
  id: string;
  type: "MCQ";
  questionText: string;
  options: string[];
  correctOption: number;
  points: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface BulkImportError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface BulkImportMeta {
  detectedFormat: "CSV" | "JSON" | "TXT";
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

export interface BulkImportServiceResult {
  statusCode: number;
  success: boolean;
  code?: string;
  message?: string;
  questions?: BulkImportQuestion[];
  errors?: BulkImportError[];
  meta?: BulkImportMeta;
}

export function parseAndValidateBulkQuestions(rawText: any): BulkImportServiceResult {
  // 1. Validation of input existence and type
  if (typeof rawText !== "string") {
    return {
      statusCode: 400,
      success: false,
      code: "BULK_IMPORT_EMPTY",
      message: "rawText string is required"
    };
  }

  // 2. Maximum input size check (512 KB UTF-8)
  const byteLength = Buffer.byteLength(rawText, "utf8");
  if (byteLength > 512 * 1024) {
    return {
      statusCode: 413,
      success: false,
      code: "BULK_IMPORT_TOO_LARGE",
      message: "Input size exceeds maximum limit of 512 KB"
    };
  }

  // 3. Clean input
  const cleanedText = rawText.replace(/^\uFEFF/, "").replace(/\0/g, "").trim();
  if (!cleanedText) {
    return {
      statusCode: 400,
      success: false,
      code: "BULK_IMPORT_EMPTY",
      message: "rawText string cannot be empty"
    };
  }

  // 4. Detect format
  let detectedFormat: "CSV" | "JSON" | "TXT" = "CSV";
  if (cleanedText.startsWith("[") || cleanedText.startsWith("{")) {
    detectedFormat = "JSON";
  } else if (
    /Question\s*\d*\s*:/i.test(cleanedText) ||
    /Q\d*\s*:/i.test(cleanedText) ||
    /(Option\s*A|A)\s*:/i.test(cleanedText) ||
    /(Answer|Correct\s*Answer)\s*:/i.test(cleanedText)
  ) {
    detectedFormat = "TXT";
  }

  // Raw row extraction based on format
  interface RawRow {
    rowNum: number;
    rawQuestionText: any;
    rawOptions: any[];
    rawCorrectOption: any;
    rawPoints: any;
    rawDifficulty: any;
  }

  const rawRows: RawRow[] = [];

  if (detectedFormat === "JSON") {
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      return {
        statusCode: 400,
        success: false,
        code: "BULK_IMPORT_INVALID_JSON",
        message: "Invalid JSON format"
      };
    }

    let items: any[] = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && Array.isArray(parsed.questions)) {
      items = parsed.questions;
    } else if (parsed && Array.isArray(parsed.data)) {
      items = parsed.data;
    } else if (parsed && typeof parsed === "object") {
      items = [parsed];
    } else {
      return {
        statusCode: 400,
        success: false,
        code: "BULK_IMPORT_INVALID_JSON",
        message: "JSON must be an array of questions or an object containing a questions array"
      };
    }

    if (items.length > 500) {
      return {
        statusCode: 422,
        success: false,
        code: "BULK_IMPORT_ROW_LIMIT_EXCEEDED",
        message: "Maximum parsed rows limit of 500 exceeded"
      };
    }

    items.forEach((item, index) => {
      const rowNum = index + 1;
      const qText = item.questionText ?? item.question_text ?? item.question ?? item.text;
      
      let opts: any[] = [];
      if (Array.isArray(item.options)) {
        opts = item.options;
      } else {
        const optA = item.optionA ?? item.option_a ?? item.option1 ?? item.a;
        const optB = item.optionB ?? item.option_b ?? item.option2 ?? item.b;
        const optC = item.optionC ?? item.option_c ?? item.option3 ?? item.c;
        const optD = item.optionD ?? item.option_d ?? item.option4 ?? item.d;
        if (optA !== undefined || optB !== undefined || optC !== undefined || optD !== undefined) {
          opts = [optA, optB, optC, optD];
        }
      }

      const correctOpt = item.correctOption ?? item.correct_option ?? item.correctAnswer ?? item.correct_answer ?? item.correctIndex ?? item.answer;
      const points = item.points ?? item.marks;
      const difficulty = item.difficulty;

      rawRows.push({
        rowNum,
        rawQuestionText: qText,
        rawOptions: opts,
        rawCorrectOption: correctOpt,
        rawPoints: points,
        rawDifficulty: difficulty
      });
    });

  } else if (detectedFormat === "TXT") {
    // Structured text splitting by blocks (e.g., blank lines or ---)
    const blocks = cleanedText.split(/(?:\r?\n){2,}|(?:\r?\n)\s*---\s*(?:\r?\n)/).filter(b => b.trim().length > 0);
    
    if (blocks.length > 500) {
      return {
        statusCode: 422,
        success: false,
        code: "BULK_IMPORT_ROW_LIMIT_EXCEEDED",
        message: "Maximum parsed rows limit of 500 exceeded"
      };
    }

    blocks.forEach((block, index) => {
      const rowNum = index + 1;
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      
      let qText: string | null = null;
      let optA: string | null = null;
      let optB: string | null = null;
      let optC: string | null = null;
      let optD: string | null = null;
      let correctOpt: string | null = null;
      let points: string | null = null;
      let difficulty: string | null = null;

      lines.forEach(line => {
        if (/^(?:Question\s*\d*|QuestionText|Q\d*)\s*:\s*/i.test(line)) {
          qText = line.replace(/^(?:Question\s*\d*|QuestionText|Q\d*)\s*:\s*/i, "").trim();
        } else if (/^(?:Option\s*A|A)\s*:\s*/i.test(line)) {
          optA = line.replace(/^(?:Option\s*A|A)\s*:\s*/i, "").trim();
        } else if (/^(?:Option\s*B|B)\s*:\s*/i.test(line)) {
          optB = line.replace(/^(?:Option\s*B|B)\s*:\s*/i, "").trim();
        } else if (/^(?:Option\s*C|C)\s*:\s*/i.test(line)) {
          optC = line.replace(/^(?:Option\s*C|C)\s*:\s*/i, "").trim();
        } else if (/^(?:Option\s*D|D)\s*:\s*/i.test(line)) {
          optD = line.replace(/^(?:Option\s*D|D)\s*:\s*/i, "").trim();
        } else if (/^(?:Correct\s*Option|Correct\s*Answer|Answer|Correct)\s*:\s*/i.test(line)) {
          correctOpt = line.replace(/^(?:Correct\s*Option|Correct\s*Answer|Answer|Correct)\s*:\s*/i, "").trim();
        } else if (/^(?:Points|Marks)\s*:\s*/i.test(line)) {
          points = line.replace(/^(?:Points|Marks)\s*:\s*/i, "").trim();
        } else if (/^(?:Difficulty)\s*:\s*/i.test(line)) {
          difficulty = line.replace(/^(?:Difficulty)\s*:\s*/i, "").trim();
        } else if (!qText) {
          qText = line;
        }
      });

      rawRows.push({
        rowNum,
        rawQuestionText: qText,
        rawOptions: [optA, optB, optC, optD],
        rawCorrectOption: correctOpt,
        rawPoints: points,
        rawDifficulty: difficulty
      });
    });

  } else {
    // CSV format parsing using Papaparse
    const parseResult = Papa.parse(cleanedText, {
      skipEmptyLines: "greedy"
    });

    const rows = parseResult.data as string[][];
    if (!rows || rows.length === 0) {
      return {
        statusCode: 400,
        success: false,
        code: "BULK_IMPORT_EMPTY",
        message: "No rows found in CSV content"
      };
    }

    // Header inspection
    const firstRow = rows[0].map(c => String(c || "").trim().toLowerCase());
    const hasHeader = firstRow.some(c => 
      c.includes("question") || 
      c.includes("option") || 
      c.includes("answer") || 
      c.includes("correct") || 
      c.includes("point") || 
      c.includes("mark") || 
      c.includes("difficult") ||
      c === "q" ||
      c === "qtext" ||
      c === "ans"
    );

    let dataRows = rows;
    let colQ = 0, colA = 1, colB = 2, colC = 3, colD = 4, colAns = 5, colPts = 6, colDiff = 7;

    if (hasHeader) {
      dataRows = rows.slice(1);
      
      // Determine column indices dynamically
      firstRow.forEach((col, idx) => {
        if (col.includes("question") || col === "q" || col === "text") colQ = idx;
        else if (col.includes("option") && (col.includes("a") || col.includes("1"))) colA = idx;
        else if (col.includes("option") && (col.includes("b") || col.includes("2"))) colB = idx;
        else if (col.includes("option") && (col.includes("c") || col.includes("3"))) colC = idx;
        else if (col.includes("option") && (col.includes("d") || col.includes("4"))) colD = idx;
        else if (col.includes("correct") || col.includes("answer") || col === "ans") colAns = idx;
        else if (col.includes("point") || col.includes("mark")) colPts = idx;
        else if (col.includes("difficult")) colDiff = idx;
      });
    }

    if (dataRows.length > 500) {
      return {
        statusCode: 422,
        success: false,
        code: "BULK_IMPORT_ROW_LIMIT_EXCEEDED",
        message: "Maximum parsed rows limit of 500 exceeded"
      };
    }

    dataRows.forEach((r, idx) => {
      const rowNum = idx + 1;
      rawRows.push({
        rowNum,
        rawQuestionText: r[colQ],
        rawOptions: [r[colA], r[colB], r[colC], r[colD]],
        rawCorrectOption: r[colAns],
        rawPoints: r[colPts],
        rawDifficulty: r[colDiff]
      });
    });
  }

  // Row limits check
  if (rawRows.length > 500) {
    return {
      statusCode: 422,
      success: false,
      code: "BULK_IMPORT_ROW_LIMIT_EXCEEDED",
      message: "Maximum parsed rows limit of 500 exceeded"
    };
  }

  const validQuestions: BulkImportQuestion[] = [];
  const errors: BulkImportError[] = [];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  const rowsWithErrors = new Set<number>();

  rawRows.forEach((r) => {
    let rowHasError = false;

    // 1. Question Text Validation
    const qText = String(r.rawQuestionText ?? "").trim();
    if (!qText || qText.length > 2000) {
      errors.push({
        row: r.rowNum,
        field: "questionText",
        code: "INVALID_QUESTION_TEXT",
        message: "Question text must be between 1 and 2000 characters"
      });
      rowHasError = true;
    }

    // 2. Options Validation
    let cleanOptions: string[] = [];
    let optionsValid = true;
    if (!Array.isArray(r.rawOptions) || r.rawOptions.length !== 4) {
      optionsValid = false;
    } else {
      cleanOptions = r.rawOptions.map(o => String(o ?? "").trim());
      if (cleanOptions.some(o => !o || o.length > 1000)) {
        optionsValid = false;
      }
    }

    if (!optionsValid) {
      errors.push({
        row: r.rowNum,
        field: "options",
        code: "INVALID_OPTIONS",
        message: "Question must have exactly 4 non-empty options (1-1000 characters each)"
      });
      rowHasError = true;
    }

    // 3. Correct Option Mapping & Validation
    let finalCorrectOption: number | null = null;
    const rawAns = r.rawCorrectOption;

    if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== "") {
      const ansStr = String(rawAns).trim();
      const ansUpper = ansStr.toUpperCase();

      // Check letter mapping A->0, B->1, C->2, D->3
      if (ansUpper === "A") finalCorrectOption = 0;
      else if (ansUpper === "B") finalCorrectOption = 1;
      else if (ansUpper === "C") finalCorrectOption = 2;
      else if (ansUpper === "D") finalCorrectOption = 3;
      // Integer 0, 1, 2, 3
      else if (ansStr === "0") finalCorrectOption = 0;
      else if (ansStr === "1") finalCorrectOption = 0; // 1-based "1" -> 0
      else if (ansStr === "2") finalCorrectOption = 1; // 1-based "2" -> 1
      else if (ansStr === "3") finalCorrectOption = 2; // 1-based "3" -> 2
      else if (ansStr === "4") finalCorrectOption = 3; // 1-based "4" -> 3
      else if (typeof rawAns === "number" && Number.isInteger(rawAns) && rawAns >= 0 && rawAns <= 3) {
        finalCorrectOption = rawAns;
      } else if (cleanOptions.length === 4) {
        // Try matching option text
        const matchIdx = cleanOptions.findIndex(opt => opt.toLowerCase() === ansStr.toLowerCase());
        if (matchIdx !== -1) {
          finalCorrectOption = matchIdx;
        }
      }
    }

    if (finalCorrectOption === null || finalCorrectOption < 0 || finalCorrectOption > 3) {
      errors.push({
        row: r.rowNum,
        field: "correctOption",
        code: "INVALID_CORRECT_OPTION",
        message: "Correct option must be A, B, C, D or 0-3 index"
      });
      rowHasError = true;
    }

    // 4. Points Validation (Default 10)
    let finalPoints = 10;
    const rawPts = r.rawPoints;
    if (rawPts !== undefined && rawPts !== null && String(rawPts).trim() !== "") {
      const parsedPts = Number(rawPts);
      if (Number.isInteger(parsedPts) && parsedPts >= 1 && parsedPts <= 1000) {
        finalPoints = parsedPts;
      } else {
        errors.push({
          row: r.rowNum,
          field: "points",
          code: "INVALID_POINTS",
          message: "Points must be an integer between 1 and 1000"
        });
        rowHasError = true;
      }
    }

    // 5. Difficulty Validation (Default MEDIUM)
    let finalDifficulty: "EASY" | "MEDIUM" | "HARD" = "MEDIUM";
    const rawDiff = r.rawDifficulty;
    if (rawDiff !== undefined && rawDiff !== null && String(rawDiff).trim() !== "") {
      const diffUpper = String(rawDiff).trim().toUpperCase();
      if (diffUpper === "EASY" || diffUpper === "MEDIUM" || diffUpper === "HARD") {
        finalDifficulty = diffUpper;
      } else {
        errors.push({
          row: r.rowNum,
          field: "difficulty",
          code: "INVALID_DIFFICULTY",
          message: "Difficulty must be EASY, MEDIUM, or HARD"
        });
        rowHasError = true;
      }
    }

    // 6. Duplicate Detection (only if questionText and options are valid)
    if (!rowHasError) {
      const dupKey = `${qText.toLowerCase()}::${cleanOptions.map(o => o.toLowerCase()).join("::")}`;
      if (seenKeys.has(dupKey)) {
        errors.push({
          row: r.rowNum,
          field: "questionText",
          code: "DUPLICATE_QUESTION",
          message: "Duplicate question detected in import batch"
        });
        rowHasError = true;
        duplicateCount++;
      } else {
        seenKeys.add(dupKey);
      }
    }

    if (rowHasError) {
      rowsWithErrors.add(r.rowNum);
    } else if (finalCorrectOption !== null) {
      validQuestions.push({
        id: `q-imp-${Date.now()}-${validQuestions.length + 1}`,
        type: "MCQ",
        questionText: qText,
        options: cleanOptions,
        correctOption: finalCorrectOption,
        points: finalPoints,
        difficulty: finalDifficulty
      });
    }
  });

  const totalRows = rawRows.length;
  const validCount = validQuestions.length;
  const invalidCount = rowsWithErrors.size;

  if (validCount === 0) {
    return {
      statusCode: 422,
      success: false,
      code: "NO_VALID_BULK_IMPORT_QUESTIONS",
      message: "No valid questions could be extracted",
      errors,
      meta: {
        detectedFormat,
        totalRows,
        validCount: 0,
        invalidCount,
        duplicateCount
      }
    };
  }

  return {
    statusCode: 200,
    success: true,
    questions: validQuestions,
    errors,
    meta: {
      detectedFormat,
      totalRows,
      validCount,
      invalidCount,
      duplicateCount
    }
  };
}
