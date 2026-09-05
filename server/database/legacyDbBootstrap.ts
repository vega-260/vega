import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
import { runSqliteInit } from "./sqliteBootstrap.ts";

dotenv.config();

let mysqlHost = process.env.DB_HOST || process.env.MYSQLHOST;
let mysqlUser = process.env.DB_USER || process.env.MYSQLUSER;
let mysqlPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
let mysqlDatabase = process.env.DB_NAME || process.env.MYSQLDATABASE;
let mysqlPort = process.env.DB_PORT || process.env.MYSQLPORT;

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (mysqlUrl) {
  try {
    const parsedUrl = new URL(mysqlUrl);
    mysqlHost = parsedUrl.hostname;
    mysqlPort = parsedUrl.port || "3306";
    if (parsedUrl.username) {
      mysqlUser = decodeURIComponent(parsedUrl.username);
    }
    if (parsedUrl.password) {
      mysqlPassword = decodeURIComponent(parsedUrl.password);
    }
    if (parsedUrl.pathname) {
      mysqlDatabase = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
    }
    console.log(`Parsed database connection URL. Host: ${mysqlHost}, Database: ${mysqlDatabase}`);
  } catch (err) {
    console.error("Error parsing database connection URL:", err);
  }
}

let isProduction = process.env.NODE_ENV === "production";
const dbTypeEnv = (process.env.DB_TYPE || "").toLowerCase();
const mysqlRequested = (dbTypeEnv === "mysql") || (!dbTypeEnv && (!!mysqlHost || !!process.env.MYSQL_URL || !!process.env.DATABASE_URL));
let useMySQL = dbTypeEnv === "sqlite" ? false : mysqlRequested;

let pool: any = null;
let sqliteDb: any = null;

function setupSQLite() {
  if (!sqliteDb) {
    sqliteDb = new Database(path.join(process.cwd(), "vega.db"));
    try {
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.pragma('synchronous = NORMAL');
      sqliteDb.pragma('busy_timeout = 10000');
      sqliteDb.pragma('temp_store = MEMORY');
    } catch (e) {
      console.warn("Could not set SQLite performance pragmas:", e);
    }
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_stage_id INTEGER NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_feedback TEXT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejected_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejected_by_user_id INTEGER NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_notification_status VARCHAR(50) DEFAULT 'NOT_REQUIRED'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_notified_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN hired_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE notifications ADD COLUMN idempotency_key TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key)"); } catch (e) {}
    try {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Untitled Assessment',
          description TEXT,
          company_id INTEGER,
          job_id INTEGER,
          stage_id INTEGER,
          cutoff_score REAL DEFAULT 40,
          duration INTEGER DEFAULT 30,
          status TEXT DEFAULT 'PUBLISHED',
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS test_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          test_id INTEGER,
          assignment_id INTEGER,
          assessment_version_id INTEGER,
          job_id INTEGER,
          application_id INTEGER,
          score REAL DEFAULT 0,
          percentage REAL DEFAULT 0,
          passed INTEGER DEFAULT 0,
          cutoff_score REAL DEFAULT 0,
          total_marks REAL DEFAULT 100,
          duration INTEGER DEFAULT 30,
          questions_json TEXT,
          violations_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'SUBMITTED',
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS test_submission_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attempt_id INTEGER,
          application_id INTEGER,
          student_id INTEGER,
          event_type TEXT NOT NULL,
          event_data TEXT,
          idempotency_key TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assessment_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER,
          job_id INTEGER,
          stage_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          cutoff_score REAL DEFAULT 40,
          version INTEGER DEFAULT 1,
          status TEXT DEFAULT 'DRAFT',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assessment_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          assessment_id INTEGER NOT NULL,
          student_user_id INTEGER NOT NULL,
          job_id INTEGER,
          application_id INTEGER,
          status TEXT DEFAULT 'STARTED',
          score REAL DEFAULT 0,
          percentage REAL DEFAULT 0,
          violations_count INTEGER DEFAULT 0,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          submitted_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS assessment_idempotency_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          operation VARCHAR(100) NOT NULL,
          idempotency_key VARCHAR(255) NOT NULL,
          request_hash VARCHAR(64) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          assessment_id INTEGER DEFAULT NULL,
          response_json TEXT DEFAULT NULL,
          locked_at DATETIME DEFAULT NULL,
          completed_at DATETIME DEFAULT NULL,
          failed_at DATETIME DEFAULT NULL,
          failure_code VARCHAR(100) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS company_assessment_definitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          questions_json TEXT NOT NULL,
          duration_minutes INTEGER DEFAULT 30,
          cutoff_score REAL DEFAULT 40,
          total_marks REAL DEFAULT 100,
          status TEXT DEFAULT 'DRAFT',
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS company_assessment_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          definition_version_id INTEGER NOT NULL,
          job_id INTEGER NOT NULL,
          stage_id INTEGER,
          cutoff_score REAL DEFAULT 40,
          status TEXT DEFAULT 'ACTIVE',
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      sqliteDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_op_key ON assessment_idempotency_requests(company_id, operation, idempotency_key)");
    } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_idempotency_requests ADD COLUMN locked_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_idempotency_requests ADD COLUMN completed_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_idempotency_requests ADD COLUMN failed_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_idempotency_requests ADD COLUMN failure_code VARCHAR(100) NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN assignment_id INTEGER NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN assessment_version_id INTEGER NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN questions_json TEXT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN cutoff_score REAL DEFAULT 0"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN total_marks REAL DEFAULT 100"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN duration INTEGER DEFAULT 30"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submission_events ADD COLUMN attempt_id INTEGER NULL"); } catch (e) {}
    console.log("📦 SQLite Database initialized (WAL mode & busy_timeout=10s active)");
  }
}

function initializeMySQLPool() {
  pool = mysql.createPool({
    host: mysqlHost || "localhost",
    user: mysqlUser || "root",
    password: mysqlPassword || "",
    database: mysqlDatabase || "talentbridge01",
    port: parseInt((mysqlPort || "3306").toString()),
    waitForConnections: true,
    connectionLimit: Math.max(5, Math.min(Number(process.env.DB_POOL_SIZE || 30), 100)), // Bounded per-process pool; scale API instances instead of opening hundreds of DB sessions
    maxIdle: Math.max(5, Math.min(Number(process.env.DB_POOL_MAX_IDLE || 15), 50)),
    idleTimeout: 30000, // 30 seconds idle release
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    queueLimit: 0,
    connectTimeout: 10000,
    timezone: 'Z' // Ensure all dates are treated as UTC
  });
}

if (useMySQL) {
  initializeMySQLPool();
} else {
  setupSQLite();
}

function isSelectQuery(sql: string): boolean {
  const clean = sql.trim().toLowerCase();
  // Strip starting comments (both block comments and line comments) if they exist
  const withoutComments = clean
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/--.*$/gm, '')           // remove inline comments
    .trim();
  
  return withoutComments.startsWith("select") || 
         withoutComments.startsWith("with") || 
         withoutComments.startsWith("show") || 
         withoutComments.startsWith("pragma") || 
         withoutComments.startsWith("explain") || 
         withoutComments.startsWith("describe") || 
         withoutComments.startsWith("(");
}

function logSafeConnectionError(err: any, context: string) {
  console.error("================================================================================");
  console.error(`🚨 CRITICAL DATABASE CONNECTION ERROR [${context}]`);
  console.error(`👉 MySQL configuration exists but connection failed!`);
  console.error(`👉 Configured Host: ${mysqlHost || 'not set'}`);
  console.error(`👉 Configured Port: ${mysqlPort || '3306'}`);
  console.error(`👉 Configured User: ${mysqlUser || 'not set'}`);
  console.error(`👉 Configured Database: ${mysqlDatabase || 'not set'}`);
  console.error(`👉 Error Details: ${err.message || err}`);
  console.error(`👉 ACTION TAKEN: Falling back to SQLite database (vega.db).`);
  console.error(`👉 WARNING: SQLite contains separate local records and may show 0 or empty lists if unpopulated!`);
  console.error("================================================================================");
}

// Unified query function for both DBs
async function performQuery(sql: string, params: any[] = []) {
  const startTime = Date.now();
  let result: any;
  try {
    const processedParams = params.map(p => {
      if (p instanceof Date) {
        if (useMySQL) {
          // Format as 'YYYY-MM-DD HH:mm:ss' for MySQL DATETIME
          return p.toISOString().slice(0, 19).replace('T', ' ');
        }
        return p.toISOString();
      }
      return p;
    });
    if (useMySQL && pool) {
      try {
        const [results] = await pool.execute(sql, processedParams);
        result = [results];
        return result;
      } catch (e: any) {
        const isConnectionError = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST'].includes(e.code) || e.message?.includes('getaddrinfo') || e.message?.includes('connect ETIMEDOUT');
        if (isConnectionError) {
          if (mysqlRequested) {
            console.error("================================================================================");
            console.error(`🚨 FATAL DATABASE QUERY CONNECTION ERROR: MySQL connection failed!`);
            console.error(`👉 Query: ${sql}`);
            console.error(`👉 Error Details: ${e.message || e}`);
            console.error("================================================================================");
            throw e;
          }
          logSafeConnectionError(e, "QUERY_FALLBACK");
          useMySQL = false;
          if (!sqliteDb) setupSQLite();
          const stmt = sqliteDb.prepare(sql);
          if (isSelectQuery(sql)) {
            const results = stmt.all(...processedParams);
            result = [results];
            return result;
          } else {
            const res = stmt.run(...processedParams);
            result = [{ insertId: res.lastInsertRowid, affectedRows: res.changes }];
            return result;
          }
        }
        throw e;
      }
    } else {
      if (!sqliteDb) setupSQLite();
      // Basic SQLite compatibility: handle result structures
      const stmt = sqliteDb.prepare(sql);
      if (isSelectQuery(sql)) {
        const results = stmt.all(...processedParams);
        result = [results]; // Return as [rows] to match mysql2 structure
        return result;
      } else {
        const res = stmt.run(...processedParams);
        result = [{ insertId: res.lastInsertRowid, affectedRows: res.changes }];
        return result;
      }
    }
  } finally {
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`⚠️ [SLOW DB QUERY] ${duration}ms | Query: ${sql.trim().substring(0, 150).replace(/\s+/g, ' ')}`);
    }
  }
}

export async function runTransaction(fn: (tx: { query: (sql: string, params?: any[]) => Promise<any> }) => Promise<any>) {
  if (useMySQL && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const txClient = {
        query: async (sql: string, params: any[] = []) => {
          const processedParams = (params || []).map(p => {
            if (p instanceof Date) {
              return p.toISOString().slice(0, 19).replace('T', ' ');
            }
            return p;
          });
          const [results] = await conn.execute(sql, processedParams);
          return [results];
        },
        execute: async (sql: string, params: any[] = []) => {
          const processedParams = (params || []).map(p => {
            if (p instanceof Date) {
              return p.toISOString().slice(0, 19).replace('T', ' ');
            }
            return p;
          });
          const [results] = await conn.execute(sql, processedParams);
          return [results];
        }
      };
      const res = await fn(txClient);
      await conn.commit();
      return res;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    if (!sqliteDb) setupSQLite();
    sqliteDb.prepare("BEGIN TRANSACTION").run();
    try {
      const txClient = {
        query: async (sql: string, params: any[] = []) => performQuery(sql, params),
        execute: async (sql: string, params: any[] = []) => performQuery(sql, params)
      };
      const res = await fn(txClient);
      sqliteDb.prepare("COMMIT").run();
      return res;
    } catch (err) {
      sqliteDb.prepare("ROLLBACK").run();
      throw err;
    }
  }
}

export const db = {
  query: performQuery,
  execute: performQuery, // Alias for mysql2 compatibility
  transaction: runTransaction,
  get useMySQL() { return useMySQL; }
};

export const queryLogger = async (queryText: string, execution: () => Promise<any>) => {
  const startTime = Date.now();
  const result = await execution();
  const duration = Date.now() - startTime;
  if (duration > 500) { // Log any query that takes longer than 500ms as SLOW
    console.warn(`⚠️ [SLOW DB QUERY] ${duration}ms | Query: ${queryText.substring(0, 100)}`);
  }
  return result;
};

export async function initDb() {
  if (process.env.NODE_ENV === "production" && !useMySQL) {
    throw new Error("Production requires MySQL. SQLite fallback is disabled in production.");
  }

  if (useMySQL) {
    console.log(`🗄️ Database Engine: MySQL | Host: ${mysqlHost || 'localhost'} | Port: ${mysqlPort || '3306'} | User: ${mysqlUser || 'not set'} | Database: ${mysqlDatabase || 'not set'}`);
    let connection;
    try {
      let retries = 5;
      let delayMs = 3000;
      while (retries > 0) {
        try {
          connection = await pool.getConnection();
          console.log(`📡 Successfully connected to MySQL Database (${mysqlDatabase || 'default'})`);
          break;
        } catch (err: any) {
          retries--;
          console.warn(`⚠️ MySQL Connection attempt failed: ${err.message || err}. Retrying in ${delayMs / 1000}s... (${retries} attempts left)`);
          if (retries === 0) {
            console.error("================================================================================");
            console.error(`🚨 FATAL: MySQL connection failed after 5 retries!`);
            console.error(`👉 Host: ${mysqlHost || 'localhost'}, Port: ${mysqlPort || '3306'}, Database: ${mysqlDatabase || 'not set'}`);
            console.error(`👉 Error Details: ${err.message || err}`);
            console.error(`👉 MySQL is configured; server startup is aborted (no SQLite fallback).`);
            console.error("================================================================================");
            throw err;
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (process.env.NODE_ENV === "production" && process.env.RUN_DB_MIGRATIONS !== "true") {
        await connection.query("SELECT 1");
        connection.release();
        console.log("✅ Production DB connectivity verified; schema migrations are handled by the migration job.");
        return;
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('STUDENT', 'COMPANY', 'TPO', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          is_verified TINYINT DEFAULT 0,
          failed_login_attempts INT DEFAULT 0,
          locked_until DATETIME DEFAULT NULL,
          xp_balance INT DEFAULT 0,
          free_mock_count INT DEFAULT 3,
          referral_code VARCHAR(10) UNIQUE,
          last_reward_claimed_at DATETIME DEFAULT NULL,
          login_streak INT DEFAULT 0,
          total_earned_xp INT DEFAULT 0,
          total_spent_xp INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS xp_transactions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          amount INT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      try {
        await connection.query(`
          ALTER TABLE xp_transactions MODIFY COLUMN type VARCHAR(50) NOT NULL
        `);
        console.log("✅ Successfully migrated xp_transactions type column to VARCHAR(50)");
      } catch (err: any) {
        console.warn("⚠️ Migration warning for xp_transactions column type modification:", err.message);
      }
      await connection.query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id INT PRIMARY KEY AUTO_INCREMENT,
          referrer_id INT NOT NULL,
          referred_user_id INT NOT NULL,
          reward_given TINYINT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          razorpay_order_id VARCHAR(255) NOT NULL,
          razorpay_payment_id VARCHAR(255),
          amount DECIMAL(10, 2) NOT NULL,
          xp_added INT NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          token VARCHAR(500) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS security_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          action VARCHAR(255) NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS otps (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(255) NOT NULL,
          code VARCHAR(10) NOT NULL,
          expires_at DATETIME NOT NULL
        );
      `);
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          role ENUM('USER', 'AI') NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_memory (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          preferences TEXT,
          weak_skills TEXT,
          goals TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_profiles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          college_id INT,
          full_name VARCHAR(255),
          bio TEXT,
          dob DATE,
          gender VARCHAR(20),
          address TEXT,
          profile_photo_url VARCHAR(255),
          aadhar_or_college_id VARCHAR(100),
          contact VARCHAR(20),
          experience_type VARCHAR(20) DEFAULT 'FRESHER',
          education_json JSON,
          experience_json JSON,
          projects_json JSON,
          skills_json JSON,
          languages_json JSON,
          social_links_json JSON,
          resume_url VARCHAR(255),
          resume_builder_json JSON,
          completeness_score INT DEFAULT 0,
          email_verified TINYINT DEFAULT 0,
          phone_verified TINYINT DEFAULT 0,
          onboarding_completed TINYINT DEFAULT 0,
          onboarding_industry VARCHAR(100),
          onboarding_status VARCHAR(100),
          onboarding_source VARCHAR(100),
          onboarding_help_actions JSON,
          batch VARCHAR(100) DEFAULT NULL,
          department VARCHAR(100) DEFAULT NULL,
          country VARCHAR(100) NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          admin_id INT NOT NULL,
          action VARCHAR(255) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin_sidebar_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          allowed_pages TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_profiles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          logo_url LONGTEXT,
          website VARCHAR(255),
          company_email VARCHAR(255),
          contact_number VARCHAR(20),
          company_type VARCHAR(100),
          industry VARCHAR(100),
          company_size VARCHAR(100),
          year_established INT,
          registration_date VARCHAR(50) NULL,
          business_name VARCHAR(255),
          gst_no VARCHAR(50) UNIQUE,
          cin_no VARCHAR(50) UNIQUE,
          pan_no VARCHAR(50) UNIQUE,
          address TEXT,
          operating_address TEXT,
          country VARCHAR(100),
          state VARCHAR(100),
          city VARCHAR(100),
          about TEXT,
          services TEXT,
          linkedin_url VARCHAR(255),
          github_url VARCHAR(255),
          entity_type VARCHAR(100),
          registry_number VARCHAR(100),
          tax_id VARCHAR(100),
          state_of_formation VARCHAR(100),
          licensing_authority VARCHAR(255),
          status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
          rejection_reason TEXT,
          completeness_score INT DEFAULT 0,
          is_submitted INT DEFAULT 0,
          verified_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // --- TPO & COLLEGE MANAGEMENT TABLES ---
      await connection.query(`
        CREATE TABLE IF NOT EXISTS college_master (
          id INT PRIMARY KEY AUTO_INCREMENT,
          college_name VARCHAR(255) NOT NULL,
          college_code VARCHAR(100) UNIQUE NOT NULL,
          university VARCHAR(255),
          address TEXT,
          district VARCHAR(100),
          state VARCHAR(100),
          website VARCHAR(255),
          contact_number VARCHAR(20),
          status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add new college_master columns dynamically for production-grade College Management
      const collegeColumns = [
        { name: "country", definition: "VARCHAR(100) DEFAULT 'India'" },
        { name: "official_email", definition: "VARCHAR(255) NULL" },
        { name: "principal_name", definition: "VARCHAR(255) NULL" },
        { name: "placement_head", definition: "VARCHAR(255) NULL" },
        { name: "college_logo", definition: "LONGTEXT NULL" }
      ];
      for (const col of collegeColumns) {
        try {
          await connection.query(`ALTER TABLE college_master ADD COLUMN ${col.name} ${col.definition}`);
        } catch (e) {}
      }

      // Add TPO Profile columns
      const tpoColumns = [
        { name: "employee_id", definition: "VARCHAR(100) NULL" },
        { name: "phone", definition: "VARCHAR(50) NULL" },
        { name: "alternate_contact", definition: "VARCHAR(50) NULL" },
        { name: "department", definition: "VARCHAR(150) DEFAULT 'Training & Placement Cell'" },
        { name: "office_location", definition: "VARCHAR(255) NULL" },
        { name: "office_hours", definition: "VARCHAR(150) NULL" },
        { name: "bio", definition: "TEXT NULL" },
        { name: "linkedin_url", definition: "VARCHAR(255) NULL" },
        { name: "profile_photo_url", definition: "LONGTEXT NULL" },
        { name: "secondary_email", definition: "VARCHAR(255) NULL" },
        { name: "experience_years", definition: "VARCHAR(50) NULL" },
        { name: "qualification", definition: "VARCHAR(150) NULL" },
        { name: "updated_at", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
      ];
      for (const col of tpoColumns) {
        try {
          await connection.query(`ALTER TABLE tpo_profiles ADD COLUMN ${col.name} ${col.definition}`);
        } catch (e) {}
      }

      // Create batches table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS batches (
          id INT PRIMARY KEY AUTO_INCREMENT,
          college_id INT NOT NULL,
          batch_name VARCHAR(100) NOT NULL,
          department VARCHAR(100),
          academic_year VARCHAR(50),
          semester VARCHAR(20),
          strength INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          assigned_tpo_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
        );
      `);

      // Create student_batch table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_batch (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL UNIQUE,
          batch_id INT NOT NULL,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        );
      `);

      // Add batch_id to student_profiles
      try {
        await connection.query(`ALTER TABLE student_profiles ADD COLUMN batch_id INT NULL`);
      } catch (e) {}

      try {
        await connection.query(`ALTER TABLE student_profiles ADD COLUMN department VARCHAR(100) NULL`);
      } catch (e) {}

      // Create audit_logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NULL,
          action VARCHAR(255) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create password_reset table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS password_reset (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used TINYINT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // Create email_logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NULL,
          email_type VARCHAR(100) NOT NULL,
          recipient VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'SENT',
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tpo_profiles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          contact_number VARCHAR(50),
          alternate_contact VARCHAR(50),
          designation VARCHAR(150),
          department VARCHAR(150) DEFAULT 'Training & Placement Cell',
          employee_id VARCHAR(100),
          phone VARCHAR(50),
          office_location VARCHAR(255),
          office_hours VARCHAR(150),
          bio TEXT,
          linkedin_url VARCHAR(255),
          profile_photo_url LONGTEXT,
          secondary_email VARCHAR(255),
          experience_years VARCHAR(50),
          qualification VARCHAR(150),
          status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
          first_login TINYINT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tpo_colleges (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tpo_id INT NOT NULL,
          college_id INT NOT NULL,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tpo_id, college_id),
          FOREIGN KEY (tpo_id) REFERENCES tpo_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tpo_verifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          document_type VARCHAR(100) NOT NULL,
          document_url VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'PENDING',
          rejection_reason TEXT,
          verified_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS events (
          id INT PRIMARY KEY AUTO_INCREMENT,
          college_id INT NOT NULL,
          tpo_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          event_type VARCHAR(100) NOT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME,
          location_or_link TEXT,
          image_url LONGTEXT,
          status VARCHAR(50) DEFAULT 'UPCOMING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE,
          FOREIGN KEY (tpo_id) REFERENCES tpo_profiles(id) ON DELETE CASCADE
        );
      `);

      try {
        await connection.query(`ALTER TABLE events MODIFY COLUMN status VARCHAR(50) DEFAULT 'UPCOMING'`);
        console.log("✅ Successfully migrated events status column to VARCHAR(50)");
      } catch (err: any) {
        console.warn("⚠️ Migration warning for events status column:", err.message);
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS placement_drives (
          id INT PRIMARY KEY AUTO_INCREMENT,
          event_id INT UNIQUE NOT NULL,
          company_name VARCHAR(255),
          job_role VARCHAR(255),
          eligibility_criteria TEXT,
          package_details VARCHAR(255),
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS event_registrations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          event_id INT NOT NULL,
          student_id INT NOT NULL,
          status ENUM('REGISTERED', 'ATTENDED', 'SELECTED', 'REJECTED') DEFAULT 'REGISTERED',
          registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(event_id, student_id),
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS college_analytics (
          id INT PRIMARY KEY AUTO_INCREMENT,
          college_id INT UNIQUE NOT NULL,
          total_students INT DEFAULT 0,
          placed_students INT DEFAULT 0,
          avg_talent_score FLOAT DEFAULT 0,
          avg_coding_score FLOAT DEFAULT 0,
          avg_interview_score FLOAT DEFAULT 0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_documents (
          id INT PRIMARY KEY AUTO_INCREMENT,
          company_id INT NOT NULL,
          doc_type VARCHAR(100) NOT NULL,
          doc_url LONGTEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin_reviews (
          id INT PRIMARY KEY AUTO_INCREMENT,
          company_id INT NOT NULL,
          admin_id INT NOT NULL,
          action ENUM('APPROVED', 'REJECTED') NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          company_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          skills_json JSON NOT NULL,
          location VARCHAR(255),
          job_type VARCHAR(100), -- Internship, Full-time, Remote
          experience_level VARCHAR(100),
          salary_range VARCHAR(100),
          education_requirement TEXT,
          responsibilities TEXT,
          qualifications TEXT,
          additional_notes TEXT,
          application_start_date DATE,
          deadline DATE,
          openings INT NOT NULL DEFAULT 1,
          status VARCHAR(50) DEFAULT 'OPEN',
          ended_at DATETIME DEFAULT NULL,
          end_reminder_sent_at DATETIME DEFAULT NULL,
          pipeline_ended_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS job_stages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          job_id INT NOT NULL,
          stage_name VARCHAR(255) NOT NULL,
          stage_type VARCHAR(100) DEFAULT 'APPLICATION',
          stage_order INT NOT NULL,
          description TEXT,
          config_json JSON,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS test_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          stage_id INT NOT NULL,
          question_text TEXT NOT NULL,
          options_json JSON NOT NULL,
          correct_answer VARCHAR(255),
          FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'INFO',
          is_read TINYINT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS test_schedules (
          id INT PRIMARY KEY AUTO_INCREMENT,
          job_id INT NOT NULL,
          stage_id INT NOT NULL,
          scheduled_at DATETIME NOT NULL,
          duration_minutes INT NOT NULL,
          cutoff_score INT DEFAULT 60,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS job_applications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          job_id INT NOT NULL,
          student_id INT NOT NULL,
          current_stage_id INT,
          status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, job_id),
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
          -- current_stage_id foreign key added later to avoid circular dependency
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS drops (
          id INT PRIMARY KEY AUTO_INCREMENT,
          company_id INT NOT NULL,
          job_id INT DEFAULT NULL,
          title VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          location VARCHAR(255) DEFAULT NULL,
          scheduled_at DATETIME DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          views_count INT DEFAULT 0,
          comments_count INT DEFAULT 0,
          shares_count INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS test_submissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          application_id INT NOT NULL,
          student_id INT NOT NULL,
          stage_id INT NOT NULL,
          answers_json JSON,
          score DECIMAL(5,2),
          tab_switches INT DEFAULT 0,
          violation_count INT DEFAULT 0,
          is_auto_submitted TINYINT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'COMPLETED',
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS interview_schedules (
          id INT PRIMARY KEY AUTO_INCREMENT,
          application_id INT NOT NULL,
          stage_id INT NOT NULL,
          interview_type VARCHAR(50),
          location_or_link TEXT,
          scheduled_at DATETIME,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'UPCOMING',
          duration INT DEFAULT 30,
          interviewer_name VARCHAR(255) DEFAULT NULL,
          instructions TEXT DEFAULT NULL,
          FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS application_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          application_id INT NOT NULL,
          stage_id INT,
          action VARCHAR(100),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE SET NULL
        );
      `);

      // Add missing current_stage_id foreign key to job_applications
      try {
        await connection.query(`
          ALTER TABLE job_applications ADD CONSTRAINT fk_current_stage 
          FOREIGN KEY (current_stage_id) REFERENCES job_stages(id) ON DELETE SET NULL
        `);
      } catch (err) { /* ignore if already exists */ }

      // Add rejection tracking columns and column type modifications to job_applications & job_stages
      try {
        await connection.query(`ALTER TABLE job_applications MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'APPLIED'`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_stages MODIFY COLUMN stage_type VARCHAR(100) DEFAULT 'APPLICATION'`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN hired_at DATETIME NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejection_stage_id INT NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejection_feedback TEXT NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejected_at DATETIME NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejected_by_user_id INT NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejection_notification_status VARCHAR(50) DEFAULT 'NOT_REQUIRED'`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE job_applications ADD COLUMN rejection_notified_at DATETIME NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE notifications ADD COLUMN idempotency_key VARCHAR(191) DEFAULT NULL`);
      } catch (e) {}
      try {
        await connection.query(`CREATE UNIQUE INDEX idx_notifications_idempotency ON notifications(idempotency_key)`);
      } catch (e) {}

      await connection.query(`
        CREATE TABLE IF NOT EXISTS tests (
          id INT PRIMARY KEY AUTO_INCREMENT,
          job_id INT UNIQUE NOT NULL,
          questions_json JSON NOT NULL,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS applications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          job_id INT NOT NULL,
          status ENUM('APPLIED', 'TEST_TAKEN', 'SHORTLISTED', 'REJECTED') DEFAULT 'APPLIED',
          test_score INT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, job_id),
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS interview_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          transcript_json JSON,
          score INT,
          communication_score INT,
          confidence_score INT,
          explanation_score INT,
          presentation_score INT,
          knowledge_score INT,
          feedback TEXT,
          strengths_json JSON,
          weaknesses_json JSON,
          tips_json JSON,
          questions_answers_json JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          template_id VARCHAR(50) NOT NULL,
          summary TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // --- NEW ANALYTICS & GAMIFICATION TABLES ---
      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_performance_stats (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          resume_score INT DEFAULT 0,
          avg_interview_score FLOAT DEFAULT 0,
          skill_count INT DEFAULT 0,
          xp_points INT DEFAULT 0,
          current_streak INT DEFAULT 0,
          last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS talent_scores (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          overall_score INT DEFAULT 0,
          breakdown_json JSON,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS extracurricular_activities (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          category VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          organization_name VARCHAR(255),
          participation_level VARCHAR(100),
          achievement_rank VARCHAR(255),
          activity_date DATE,
          certificate_url TEXT,
          ai_analysis_json JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS leadership_analysis (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          leadership_score INT DEFAULT 0,
          ai_feedback TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS activity_tracking (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          streak_days INT DEFAULT 0,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          consistency_score INT DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);


      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_activity_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          path TEXT NOT NULL,
          action VARCHAR(100) NOT NULL,
          duration_seconds INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS daily_tasks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          task_date DATE NOT NULL,
          is_check_in_completed TINYINT DEFAULT 0,
          is_interview_completed TINYINT DEFAULT 0,
          is_profile_updated TINYINT DEFAULT 0,
          xp_earned INT DEFAULT 0,
          UNIQUE(user_id, task_date),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS profile_views (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          company_id INT NOT NULL,
          viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_badges (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          badge_name VARCHAR(100) NOT NULL,
          badge_type ENUM('BEGINNER', 'INTERMEDIATE', 'PRO') DEFAULT 'BEGINNER',
          earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, badge_name),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // --- SECTION-WISE PROFILE TABLES ---
      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_education (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          institution VARCHAR(255) NOT NULL,
          degree VARCHAR(255) NOT NULL,
          field_of_study VARCHAR(255),
          start_date DATE,
          end_date DATE,
          grade VARCHAR(50),
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_projects (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          tech_stack TEXT,
          link TEXT,
          github_link TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_experience (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          company VARCHAR(255) NOT NULL,
          role VARCHAR(255) NOT NULL,
          location VARCHAR(255),
          start_date DATE,
          end_date DATE,
          is_current TINYINT DEFAULT 0,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_certifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          issuing_organization VARCHAR(255) NOT NULL,
          issue_date DATE,
          expiry_date DATE,
          credential_id VARCHAR(255),
          credential_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS system_configs (
          config_key VARCHAR(100) PRIMARY KEY,
          config_value VARCHAR(255) NOT NULL,
          description VARCHAR(255)
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS xp_packages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          xp_amount INT NOT NULL,
          price_inr INT NOT NULL,
          is_popular TINYINT DEFAULT 0,
          is_best_value TINYINT DEFAULT 0,
          mock_interviews_included INT DEFAULT NULL,
          resume_reviews_included INT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_visibility (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT UNIQUE NOT NULL,
          visibility VARCHAR(50) DEFAULT 'PUBLIC',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS profile_comparisons (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          target_id INT NOT NULL,
          type VARCHAR(50) DEFAULT 'BASIC',
          xp_spent INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // --- AI RESUME INTELLIGENCE ENGINE TABLES ---
      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_files (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size INT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          checksum VARCHAR(255),
          is_scanned_clean TINYINT DEFAULT 1,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_analysis (
          id INT PRIMARY KEY AUTO_INCREMENT,
          file_id INT NOT NULL,
          user_id INT NOT NULL,
          target_role VARCHAR(100) DEFAULT 'Custom Role',
          parsed_text LONGTEXT,
          parsed_json LONGTEXT,
          overall_ats_score INT DEFAULT 0,
          health_level VARCHAR(50) DEFAULT 'Average',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_scores (
          id INT PRIMARY KEY AUTO_INCREMENT,
          analysis_id INT NOT NULL,
          structure_score INT DEFAULT 0,
          completeness_score INT DEFAULT 0,
          keyword_score INT DEFAULT 0,
          skills_score INT DEFAULT 0,
          grammar_score INT DEFAULT 0,
          formatting_score INT DEFAULT 0,
          projects_score INT DEFAULT 0,
          action_verbs_score INT DEFAULT 0,
          achievements_score INT DEFAULT 0,
          links_score INT DEFAULT 0,
          deductions_json LONGTEXT,
          FOREIGN KEY (analysis_id) REFERENCES resume_analysis(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_keywords (
          id INT PRIMARY KEY AUTO_INCREMENT,
          analysis_id INT NOT NULL,
          detected_keywords_json LONGTEXT,
          missing_keywords_json LONGTEXT,
          ats_unrecognized_json LONGTEXT,
          FOREIGN KEY (analysis_id) REFERENCES resume_analysis(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_role_matches (
          id INT PRIMARY KEY AUTO_INCREMENT,
          analysis_id INT NOT NULL,
          target_role VARCHAR(100) NOT NULL,
          match_percentage INT DEFAULT 0,
          missing_role_skills_json LONGTEXT,
          learning_path_json LONGTEXT,
          FOREIGN KEY (analysis_id) REFERENCES resume_analysis(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_ai_feedback (
          id INT PRIMARY KEY AUTO_INCREMENT,
          analysis_id INT NOT NULL,
          summary_feedback TEXT,
          experience_feedback_json LONGTEXT,
          project_evaluations_json LONGTEXT,
          skill_gap_analysis_json LONGTEXT,
          formatting_analysis_json LONGTEXT,
          grammar_analysis_json LONGTEXT,
          readability_json LONGTEXT,
          recruiter_view_json LONGTEXT,
          ats_preview_json LONGTEXT,
          improvement_plan_json LONGTEXT,
          FOREIGN KEY (analysis_id) REFERENCES resume_analysis(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_reports (
          id INT PRIMARY KEY AUTO_INCREMENT,
          analysis_id INT NOT NULL,
          user_id INT NOT NULL,
          report_data_json LONGTEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (analysis_id) REFERENCES resume_analysis(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS resume_security_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          ip_address VARCHAR(45),
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS comparison_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          compared_student_id INT NOT NULL,
          comparison_type VARCHAR(50) NOT NULL,
          xp_spent INT DEFAULT 0,
          gap_analysis_json LONGTEXT,
          roadmap_json LONGTEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS career_gap_reports (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          target_id INT NOT NULL,
          gap_analysis_json LONGTEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_roadmaps (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_id INT NOT NULL,
          target_id INT NOT NULL,
          roadmap_json LONGTEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS recommendation_notifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          company_id INT NOT NULL,
          job_id INT NOT NULL,
          student_user_id INT NOT NULL,
          match_score INT,
          matched_skills_json LONGTEXT,
          recommendation_reason TEXT,
          notification_status VARCHAR(50) DEFAULT 'SENT',
          notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // Ensure columns exist for older schemas
      const [columns]: any = await connection.query("SHOW COLUMNS FROM interview_history");
      const columnNames = columns.map((c: any) => c.Field);
      
      const requiredColumns = [
        { name: "transcript_json", type: "JSON", after: "student_id" },
        { name: "score", type: "INT", after: "transcript_json" },
        { name: "communication_score", type: "INT", after: "score" },
        { name: "confidence_score", type: "INT", after: "communication_score" },
        { name: "explanation_score", type: "INT", after: "confidence_score" },
        { name: "presentation_score", type: "INT", after: "explanation_score" },
        { name: "knowledge_score", type: "INT", after: "presentation_score" },
        { name: "feedback", type: "TEXT", after: "knowledge_score" },
        { name: "strengths_json", type: "JSON", after: "feedback" },
        { name: "weaknesses_json", type: "JSON", after: "strengths_json" },
        { name: "tips_json", type: "JSON", after: "weaknesses_json" },
        { name: "questions_answers_json", type: "JSON", after: "tips_json" }
      ];

      for (const col of requiredColumns) {
        if (!columnNames.includes(col.name)) {
          console.log(`📡 Adding missing column ${col.name} to interview_history...`);
          try {
            await connection.query(`ALTER TABLE interview_history ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}`);
          } catch (err) {
            console.warn(`⚠️ Could not add column ${col.name} after ${col.after}, trying without AFTER:`, err);
            await connection.query(`ALTER TABLE interview_history ADD COLUMN ${col.name} ${col.type}`);
          }
        }
      }

      // Add student_profiles columns if missing
      const [studentCols]: any = await connection.query("SHOW COLUMNS FROM student_profiles");
      const studentColNames = studentCols.map((c: any) => c.Field);
      const requiredStudentCols = [
        { name: "college_id", type: "INT" },
        { name: "bio", type: "TEXT" },
        { name: "dob", type: "DATE" },
        { name: "gender", type: "VARCHAR(20)" },
        { name: "address", type: "TEXT" },
        { name: "profile_photo_url", type: "LONGTEXT" },
        { name: "experience_type", type: "VARCHAR(20) DEFAULT 'FRESHER'" },
        { name: "headline", type: "VARCHAR(255)" },
        { name: "location", type: "VARCHAR(255)" },
        { name: "preferred_job_role", type: "VARCHAR(255)" },
        { name: "preferred_location", type: "VARCHAR(255)" },
        { name: "availability", type: "VARCHAR(100)" },
        { name: "experience_json", type: "JSON" },
        { name: "projects_json", type: "JSON" },
        { name: "languages_json", type: "JSON" },
        { name: "social_links_json", type: "JSON" },
        { name: "email_verified", type: "TINYINT DEFAULT 0" },
        { name: "phone_verified", type: "TINYINT DEFAULT 0" },
        { name: "onboarding_completed", type: "TINYINT DEFAULT 0" },
        { name: "onboarding_industry", type: "VARCHAR(100)" },
        { name: "onboarding_status", type: "VARCHAR(100)" },
        { name: "onboarding_source", type: "VARCHAR(100)" },
        { name: "onboarding_help_actions", type: "JSON" },
        { name: "last_resume_reset_at", type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
        { name: "daily_resume_count", type: "INT DEFAULT 0" },
        { name: "batch", type: "VARCHAR(100)" },
        { name: "tb_id", type: "VARCHAR(100)" },
        { name: "profile_visibility", type: "VARCHAR(50) DEFAULT 'PUBLIC'" },
        { name: "is_placed", type: "TINYINT DEFAULT 0" },
        { name: "placed_company", type: "VARCHAR(255) DEFAULT NULL" },
        { name: "is_top_performer", type: "TINYINT DEFAULT 0" },
        { name: "country", type: "VARCHAR(100) NULL" },
        { name: "aadhar_or_college_id", type: "VARCHAR(100) NULL" }
      ];

      for (const col of requiredStudentCols) {
        try {
          if (!studentColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to student_profiles...`);
            await connection.query(`ALTER TABLE student_profiles ADD COLUMN ${col.name} ${col.type}`);
          } else if (col.name === "profile_photo_url") {
            // Force update to LONGTEXT if it's currently VARCHAR to support base64
            await connection.query(`ALTER TABLE student_profiles MODIFY COLUMN profile_photo_url LONGTEXT`);
          }
        } catch (e) {
          console.error(`Error migrating student_profiles column ${col.name}:`, e);
        }
      }

      // Add company_profiles columns if missing
      const [compCols]: any = await connection.query("SHOW COLUMNS FROM company_profiles");
      const compColNames = compCols.map((c: any) => c.Field);
      const requiredCompCols = [
        { name: "logo_url", type: "LONGTEXT" },
        { name: "company_email", type: "VARCHAR(255)" },
        { name: "contact_number", type: "VARCHAR(20)" },
        { name: "company_type", type: "VARCHAR(100)" },
        { name: "industry", type: "VARCHAR(100)" },
        { name: "company_size", type: "VARCHAR(100)" },
        { name: "year_established", type: "INT" },
        { name: "registration_date", type: "VARCHAR(50) NULL" },
        { name: "business_name", type: "VARCHAR(255)" },
        { name: "gst_no", type: "VARCHAR(50)" },
        { name: "cin_no", type: "VARCHAR(50)" },
        { name: "pan_no", type: "VARCHAR(50)" },
        { name: "address", type: "TEXT" },
        { name: "operating_address", type: "TEXT" },
        { name: "country", type: "VARCHAR(100)" },
        { name: "state", type: "VARCHAR(100)" },
        { name: "city", type: "VARCHAR(100)" },
        { name: "about", type: "TEXT" },
        { name: "services", type: "TEXT" },
        { name: "linkedin_url", type: "VARCHAR(255)" },
        { name: "github_url", type: "VARCHAR(255)" },
        { name: "entity_type", type: "VARCHAR(100)" },
        { name: "registry_number", type: "VARCHAR(100)" },
        { name: "tax_id", type: "VARCHAR(100)" },
        { name: "state_of_formation", type: "VARCHAR(100)" },
        { name: "licensing_authority", type: "VARCHAR(255)" },
        { name: "rejection_reason", type: "TEXT" },
        { name: "completeness_score", type: "INT DEFAULT 0" },
        { name: "is_submitted", type: "INT DEFAULT 0" },
        { name: "verified_at", type: "DATETIME" }
      ];

      for (const col of requiredCompCols) {
        try {
          if (!compColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to company_profiles...`);
            await connection.query(`ALTER TABLE company_profiles ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`Error migrating company_profiles column ${col.name}:`, e);
        }
      }

      // Ensure role column supports 'TPO' and other roles in the ENUM
      try {
        console.log("📡 Ensuring users 'role' column ENUM values support 'TPO'...");
        await connection.query(`
          ALTER TABLE users MODIFY COLUMN role ENUM('STUDENT', 'COMPANY', 'TPO', 'ADMIN', 'SUPER_ADMIN') NOT NULL
        `);
      } catch (err: any) {
        console.warn("⚠️ Migration warning for users role enum:", err.message);
      }

      // Add missing users columns
      const [userCols]: any = await connection.query("SHOW COLUMNS FROM users");
      const userColNames = userCols.map((c: any) => c.Field);
      const requiredUserCols = [
        { name: "is_verified", type: "TINYINT DEFAULT 0" },
        { name: "failed_login_attempts", type: "INT DEFAULT 0" },
        { name: "locked_until", type: "DATETIME DEFAULT NULL" },
        { name: "xp_balance", type: "INT DEFAULT 0" },
        { name: "free_mock_count", type: "INT DEFAULT 3" },
        { name: "referral_code", type: "VARCHAR(10)" },
        { name: "last_reward_claimed_at", type: "DATETIME" },
        { name: "login_streak", type: "INT DEFAULT 0" },
        { name: "total_earned_xp", type: "INT DEFAULT 0" },
        { name: "total_spent_xp", type: "INT DEFAULT 0" }
      ];

      for (const col of requiredUserCols) {
        try {
          if (!userColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to users...`);
            await connection.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`Error migrating users column ${col.name}:`, e);
        }
      }

      // Add test_submissions columns if missing
      const [testSubCols]: any = await connection.query("SHOW COLUMNS FROM test_submissions");
      const testSubColNames = testSubCols.map((c: any) => c.Field);
      const requiredTestSubCols = [
        { name: "tab_switches", type: "INT DEFAULT 0" },
        { name: "violation_count", type: "INT DEFAULT 0" },
        { name: "is_auto_submitted", type: "TINYINT DEFAULT 0" }
      ];

      for (const col of requiredTestSubCols) {
        try {
          if (!testSubColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to test_submissions...`);
            await connection.query(`ALTER TABLE test_submissions ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`Error migrating test_submissions column ${col.name}:`, e);
        }
      }

      // Ensure interview_schedules columns are migrated for MySQL
      try {
        const [schedCols]: any = await connection.query("SHOW COLUMNS FROM interview_schedules");
        const schedColNames = schedCols.map((c: any) => c.Field);
        const requiredSchedCols = [
          { name: "status", type: "VARCHAR(50) DEFAULT 'UPCOMING'" },
          { name: "duration", type: "INT DEFAULT 30" },
          { name: "interviewer_name", type: "VARCHAR(255) DEFAULT NULL" },
          { name: "instructions", type: "TEXT DEFAULT NULL" },
          { name: "scheduler_hr_name", type: "VARCHAR(255) DEFAULT NULL" }
        ];

        for (const col of requiredSchedCols) {
          if (!schedColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to interview_schedules...`);
            await connection.query(`ALTER TABLE interview_schedules ADD COLUMN ${col.name} ${col.type}`);
          }
        }
      } catch (e) {
        console.error("Error migrating interview_schedules columns:", e);
      }

      // Add missing recommendation_notifications columns for MySQL
      try {
        const [recCols]: any = await connection.query("SHOW COLUMNS FROM recommendation_notifications");
        const recColNames = recCols.map((c: any) => c.Field);
        const requiredRecCols = [
          { name: "matched_skills_json", type: "LONGTEXT" },
          { name: "recommendation_reason", type: "TEXT" },
          { name: "notification_status", type: "VARCHAR(50) DEFAULT 'SENT'" }
        ];

        for (const col of requiredRecCols) {
          if (!recColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to recommendation_notifications...`);
            await connection.query(`ALTER TABLE recommendation_notifications ADD COLUMN ${col.name} ${col.type}`);
          }
        }
      } catch (e) {
        console.error("Error migrating recommendation_notifications columns:", e);
      }

      // Add missing drops columns and engagement tables for MySQL
      try {
        const [dropCols]: any = await connection.query("SHOW COLUMNS FROM drops");
        const dropColNames = dropCols.map((c: any) => c.Field);
        const requiredDropCols = [
          { name: "custom_label", type: "VARCHAR(100) DEFAULT NULL" },
          { name: "image_url", type: "LONGTEXT DEFAULT NULL" },
          { name: "images_json", type: "JSON DEFAULT NULL" },
          { name: "likes_count", type: "INT DEFAULT 0" },
          { name: "moderation_status", type: "VARCHAR(50) DEFAULT 'APPROVED'" },
          { name: "moderation_reason", type: "VARCHAR(255) DEFAULT NULL" }
        ];

        for (const col of requiredDropCols) {
          if (!dropColNames.includes(col.name)) {
            console.log(`📡 Adding missing column ${col.name} to drops...`);
            await connection.query(`ALTER TABLE drops ADD COLUMN ${col.name} ${col.type}`);
          }
        }
      } catch (e) {
        console.error("Error migrating drops columns:", e);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS drop_views (
            id INT PRIMARY KEY AUTO_INCREMENT,
            drop_id INT NOT NULL,
            viewer_user_id INT NOT NULL,
            viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_drop_viewer (drop_id, viewer_user_id),
            FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE CASCADE,
            FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS drop_likes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            drop_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_drop_like (drop_id, user_id),
            FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS drop_comments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            drop_id INT NOT NULL,
            user_id INT NOT NULL,
            comment_text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);
      } catch (e) {
        console.error("Error creating drop engagement tables:", e);
      }

      // --- ENTERPRISE INTERVIEW PLATFORM TABLES (MySQL Versions) ---
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_transcripts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            speaker VARCHAR(50),
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_recordings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            recording_url LONGTEXT,
            duration INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_events (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            event_type VARCHAR(100),
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_warnings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            warning_type VARCHAR(100),
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_evaluations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            technical_knowledge INT DEFAULT 0,
            communication INT DEFAULT 0,
            confidence INT DEFAULT 0,
            leadership INT DEFAULT 0,
            problem_solving INT DEFAULT 0,
            cultural_fit INT DEFAULT 0,
            comments TEXT,
            saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_ai_analysis (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            communication_score DOUBLE DEFAULT 0,
            confidence_score DOUBLE DEFAULT 0,
            technical_understanding_score DOUBLE DEFAULT 0,
            problem_solving_score DOUBLE DEFAULT 0,
            leadership_score DOUBLE DEFAULT 0,
            overall_recommendation TEXT,
            strengths TEXT,
            weaknesses TEXT,
            key_discussion_points TEXT,
            areas_of_improvement TEXT,
            hiring_recommendation TEXT,
            analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_reports (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            report_data TEXT,
            pdf_url LONGTEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS interview_attendees (
            id INT PRIMARY KEY AUTO_INCREMENT,
            interview_id INT NOT NULL,
            name VARCHAR(255) DEFAULT NULL,
            email VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
          );
        `);
      } catch (err) {
        console.error("Error creating custom interview tracking tables in MySQL:", err);
      }

      // --- PSYCHOMETRIC ASSESSMENT TABLES ---
      await connection.query(`
        CREATE TABLE IF NOT EXISTS psychometric_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          category ENUM('PERSONALITY', 'COGNITIVE', 'BEHAVIOR', 'SITUATIONAL') NOT NULL,
          trait VARCHAR(100), -- Leadership, Teamwork, etc.
          question_text TEXT NOT NULL,
          options_json JSON NOT NULL, -- [{text: "...", score_mapping: { Leadership: 5, Teamwork: 2 }}]
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS psychometric_attempts (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          status ENUM('STARTED', 'COMPLETED', 'FAILED') DEFAULT 'STARTED',
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          violation_count INT DEFAULT 0,
          tab_switches INT DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS psychometric_results (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          attempt_id INT NOT NULL,
          overall_score DECIMAL(5,2),
          traits_json JSON, -- { Leadership: 85, Communication: 70, ... }
          personality_type VARCHAR(100),
          behavioral_summary TEXT,
          recommendation_tags JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (attempt_id) REFERENCES psychometric_attempts(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS psychometric_violations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          attempt_id INT NOT NULL,
          violation_type VARCHAR(100), -- TAB_SWITCH, EXIT_FULLSCREEN, FACE_NOT_DETECTED
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attempt_id) REFERENCES psychometric_attempts(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS accessibility_preferences (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          accessibility_mode TINYINT DEFAULT 0,
          voice_enabled TINYINT DEFAULT 0,
          contrast_mode VARCHAR(50) DEFAULT 'NORMAL',
          font_size VARCHAR(20) DEFAULT 'MEDIUM',
          last_used_voice VARCHAR(100),
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS voice_command_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          command TEXT NOT NULL,
          intent VARCHAR(100),
          confidence FLOAT,
          success TINYINT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS pq_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          question TEXT NOT NULL,
          options_json JSON NOT NULL,
          category VARCHAR(100),
          weight INT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS iq_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          question TEXT NOT NULL,
          options_json JSON NOT NULL,
          answer TEXT NOT NULL,
          difficulty VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS eq_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          question TEXT NOT NULL,
          options_json JSON NOT NULL,
          emotional_trait VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS sq_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          question TEXT NOT NULL,
          options_json JSON NOT NULL,
          social_trait VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS student_assessment_results (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          pq_score INT,
          iq_score INT,
          eq_score INT,
          sq_score INT,
          pq_details_json JSON,
          iq_details_json JSON,
          eq_details_json JSON,
          sq_details_json JSON,
          ai_behavioral_summary TEXT,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_memory (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          preferences_json JSON,
          recent_actions_json JSON,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS interview_sessions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          role VARCHAR(255),
          level VARCHAR(100),
          techstack TEXT,
          focus VARCHAR(100),
          difficulty VARCHAR(100),
          communication VARCHAR(100),
          score INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'IN_PROGRESS',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS interview_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          session_id INT NOT NULL,
          question TEXT NOT NULL,
          difficulty VARCHAR(50),
          category VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS interview_answers (
          id INT PRIMARY KEY AUTO_INCREMENT,
          session_id INT NOT NULL,
          question_id INT NOT NULL,
          answer TEXT,
          ai_feedback TEXT,
          score INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          quiz_type VARCHAR(100),
          role VARCHAR(255),
          skills TEXT,
          difficulty VARCHAR(50),
          total_questions INT,
          score INT DEFAULT 0,
          percentage DECIMAL(5,2) DEFAULT 0,
          violations INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'GENERATING',
          ai_feedback TEXT,
          strengths_json TEXT,
          weaknesses_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          quiz_id INT NOT NULL,
          question TEXT NOT NULL,
          options_json TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          explanation TEXT NOT NULL,
          user_answer TEXT,
          is_correct BOOLEAN,
          FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS coding_profiles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          platform VARCHAR(100) NOT NULL,
          profile_url VARCHAR(500) NOT NULL,
          username VARCHAR(255) NOT NULL,
          is_verified TINYINT DEFAULT 1,
          last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, platform),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS coding_stats (
          id INT PRIMARY KEY AUTO_INCREMENT,
          profile_id INT UNIQUE NOT NULL,
          problems_solved INT DEFAULT 0,
          contest_rating INT DEFAULT 0,
          streak INT DEFAULT 0,
          difficulty_breakdown_json JSON,
          topics_json JSON,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (profile_id) REFERENCES coding_profiles(id) ON DELETE CASCADE
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS coding_analysis (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT UNIQUE NOT NULL,
          coding_score INT DEFAULT 0,
          strengths_json JSON,
          weaknesses_json JSON,
          ai_feedback TEXT,
          recommendations_json JSON,
          analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // Seed psychometric questions if empty
      const [existingQuestions]: any = await connection.query("SELECT COUNT(*) as count FROM psychometric_questions");
      if (existingQuestions[0].count === 0) {
        console.log("🌱 Seeding psychometric questions...");
        const questions = [
          // Personality - Leadership
          {
            category: 'PERSONALITY',
            trait: 'Leadership',
            text: 'When working in a group, I prefer to take charge of organizing the tasks.',
            options: [
              { text: 'Strongly Agree', mapping: { Leadership: 10, Confidence: 5 } },
              { text: 'Agree', mapping: { Leadership: 7, Confidence: 3 } },
              { text: 'Neutral', mapping: { Leadership: 5, Confidence: 2 } },
              { text: 'Disagree', mapping: { Leadership: 2, Confidence: 0 } }
            ]
          },
          // Personality - Teamwork
          {
            category: 'PERSONALITY',
            trait: 'Teamwork',
            text: 'I find it easy to cooperate with others to achieve a common goal.',
            options: [
              { text: 'Strongly Agree', mapping: { Teamwork: 10, Adaptability: 5 } },
              { text: 'Agree', mapping: { Teamwork: 7, Adaptability: 3 } },
              { text: 'Neutral', mapping: { Teamwork: 5, Adaptability: 2 } },
              { text: 'Disagree', mapping: { Teamwork: 2, Adaptability: 0 } }
            ]
          },
          // Cognitive - Problem Solving
          {
            category: 'COGNITIVE',
            trait: 'Problem Solving',
            text: 'Which number should come next in the pattern: 2, 4, 8, 16, ...?',
            options: [
              { text: '32', mapping: { 'Problem Solving': 10, 'Logical Reasoning': 5 } },
              { text: '24', mapping: { 'Problem Solving': 0, 'Logical Reasoning': 0 } },
              { text: '20', mapping: { 'Problem Solving': 0, 'Logical Reasoning': 0 } },
              { text: '64', mapping: { 'Problem Solving': 2, 'Logical Reasoning': 1 } }
            ]
          },
          // Situational
          {
            category: 'SITUATIONAL',
            trait: 'Decision Making',
            text: 'How would you respond if a team member misses a critical deadline?',
            options: [
              { text: 'Schedule a meeting to understand the cause and help them catch up.', mapping: { 'Leadership': 8, 'Teamwork': 10, 'Communication': 7 } },
              { text: 'Report them immediately to the supervisor.', mapping: { 'Leadership': 2, 'Professional Ethics': 5 } },
              { text: 'Do their work yourself to ensure the deadline is met.', mapping: { 'Responsibility': 10, 'Teamwork': 2 } },
              { text: 'Ignore it and focus on your own tasks.', mapping: { 'Professional Ethics': 0, 'Teamwork': 0 } }
            ]
          }
        ];

        for (const q of questions) {
          await connection.query(
            "INSERT INTO psychometric_questions (category, trait, question_text, options_json) VALUES (?, ?, ?, ?)",
            [q.category, q.trait, q.text, JSON.stringify(q.options)]
          );
        }
      }

      // Migration for interactive job stages
    try {
      if (useMySQL && pool) {
        await pool.query("ALTER TABLE job_stages ADD COLUMN stage_type VARCHAR(100) DEFAULT 'APPLICATION' AFTER stage_name");
        await pool.query("ALTER TABLE job_stages ADD COLUMN config_json JSON AFTER description");
      } else {
        sqliteDb.exec("ALTER TABLE job_stages ADD COLUMN stage_type TEXT DEFAULT 'APPLICATION'");
        sqliteDb.exec("ALTER TABLE job_stages ADD COLUMN config_json TEXT");
      }
    } catch (e) { /* existing */ }

    // Migration for new job columns
    try {
      const columnsToAdd = [
        { name: "location", type: "VARCHAR(255)" },
        { name: "job_type", type: "VARCHAR(100)" },
        { name: "experience_level", type: "VARCHAR(100)" },
        { name: "salary_range", type: "VARCHAR(100)" },
        { name: "education_requirement", type: "TEXT" },
        { name: "responsibilities", type: "TEXT" },
        { name: "qualifications", type: "TEXT" },
        { name: "additional_notes", type: "TEXT" },
        { name: "application_start_date", type: "DATE" },
        { name: "deadline", type: "DATE" },
        { name: "ended_at", type: "DATETIME" },
        { name: "end_reminder_sent_at", type: "DATETIME" },
        { name: "pipeline_ended_at", type: "DATETIME" },
        { name: "publish_destination", type: "VARCHAR(100) DEFAULT 'JOB_ONLY'" },
        { name: "openings", type: "INT NOT NULL DEFAULT 1" }
      ];

      for (const col of columnsToAdd) {
        try {
          if (useMySQL && pool) {
            await pool.query(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type}`);
          } else {
            sqliteDb.exec(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type.replace("VARCHAR(255)", "TEXT").replace("VARCHAR(100)", "TEXT")}`);
          }
        } catch (e) { /* ignore if column exists */ }
      }
    } catch (e) { console.error("Job table migration failed:", e); }

    // Alter events table for event_type format and optional image_url
    try {
      if (useMySQL && pool) {
        try {
          await pool.query("ALTER TABLE events MODIFY COLUMN event_type VARCHAR(100) NOT NULL");
        } catch (e) {}
        try {
          await pool.query("ALTER TABLE events ADD COLUMN image_url LONGTEXT DEFAULT NULL");
        } catch (e) {
          try {
            await pool.query("ALTER TABLE events MODIFY COLUMN image_url LONGTEXT DEFAULT NULL");
          } catch (err) {}
        }
      }
    } catch (e) { console.error("Events table modification failed:", e); }

    // Create CAMS (College Assessment Management System) Tables on MySQL
    if (useMySQL && pool) {
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_batches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            college_id INT NOT NULL,
            tpo_id INT DEFAULT NULL,
            department VARCHAR(100) NOT NULL,
            academic_year VARCHAR(50) NOT NULL,
            batch_name VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_batches:", err.message);
      }

      // Ensure college_id exists on assessment_batches (MySQL)
      try {
        await connection.query("SELECT college_id FROM assessment_batches LIMIT 1");
      } catch (columnErr) {
        try {
          await connection.query("ALTER TABLE assessment_batches ADD COLUMN college_id INT NOT NULL AFTER id");
          console.log("Successfully added college_id column to assessment_batches on MySQL");
        } catch (alterErr: any) {
          console.error("Failed to add college_id to assessment_batches on MySQL:", alterErr.message);
        }
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_tests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tpo_id INT NOT NULL,
            college_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            instructions TEXT,
            category VARCHAR(100) DEFAULT 'Aptitude',
            difficulty VARCHAR(50) DEFAULT 'Medium',
            language VARCHAR(50) DEFAULT 'English',
            department VARCHAR(100) DEFAULT NULL,
            max_marks INT DEFAULT 100,
            passing_marks INT DEFAULT 40,
            negative_marking TINYINT DEFAULT 0,
            randomize_questions TINYINT DEFAULT 0,
            randomize_options TINYINT DEFAULT 0,
            calculator_allowed TINYINT DEFAULT 0,
            status VARCHAR(50) DEFAULT 'DRAFT',
            test_date DATE DEFAULT NULL,
            start_time VARCHAR(20) DEFAULT NULL,
            end_time VARCHAR(20) DEFAULT NULL,
            late_join_window INT DEFAULT 10,
            duration_minutes INT DEFAULT 60,
            webcam_monitoring TINYINT DEFAULT 0,
            camera_required TINYINT DEFAULT 0,
            microphone_required TINYINT DEFAULT 0,
            location_mandatory TINYINT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_tests:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assessment_id INT NOT NULL,
            batch_name VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_assignments:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_questions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assessment_id INT NOT NULL,
            question_text TEXT NOT NULL,
            question_type VARCHAR(100) NOT NULL,
            options_json TEXT,
            correct_answers_json TEXT,
            marks INT DEFAULT 1,
            negative_marks REAL DEFAULT 0.0,
            explanation TEXT,
            image_url TEXT,
            topic VARCHAR(255) DEFAULT NULL,
            difficulty VARCHAR(50) DEFAULT 'Medium',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_questions:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS question_bank (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tpo_id INT NOT NULL,
            topic VARCHAR(255) DEFAULT NULL,
            question_text TEXT NOT NULL,
            question_type VARCHAR(100) NOT NULL,
            difficulty VARCHAR(50) DEFAULT 'Medium',
            options_json TEXT,
            correct_answers_json TEXT,
            explanation TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating question_bank:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assessment_id INT NOT NULL,
            student_user_id INT NOT NULL,
            status VARCHAR(50) DEFAULT 'STARTED',
            score REAL DEFAULT 0,
            percentage REAL DEFAULT 0,
            rank_val INT DEFAULT NULL,
            is_passed TINYINT DEFAULT 0,
            started_at DATETIME NOT NULL,
            submitted_at DATETIME DEFAULT NULL,
            total_time_taken_seconds INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE,
            FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_attempts:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_answers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            attempt_id INT NOT NULL,
            question_id INT NOT NULL,
            student_answer_json TEXT,
            is_correct TINYINT DEFAULT 0,
            marks_obtained REAL DEFAULT 0,
            time_spent_seconds INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_answers:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_violations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            attempt_id INT NOT NULL,
            violation_type VARCHAR(100) NOT NULL,
            warning_count INT DEFAULT 1,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_violations:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_location (
            id INT AUTO_INCREMENT PRIMARY KEY,
            attempt_id INT NOT NULL,
            latitude REAL DEFAULT NULL,
            longitude REAL DEFAULT NULL,
            accuracy REAL DEFAULT NULL,
            ip_address VARCHAR(100) DEFAULT NULL,
            browser VARCHAR(255) DEFAULT NULL,
            device VARCHAR(255) DEFAULT NULL,
            location_address TEXT DEFAULT NULL,
            captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_location:", err.message);
      }

      // Ensure location_address exists on assessment_location (MySQL)
      try {
        await connection.query("SELECT location_address FROM assessment_location LIMIT 1");
      } catch (columnErr) {
        try {
          await connection.query("ALTER TABLE assessment_location ADD COLUMN location_address TEXT DEFAULT NULL");
          console.log("Successfully added location_address column to assessment_location on MySQL");
        } catch (alterErr: any) {
          console.error("Failed to add location_address to assessment_location on MySQL:", alterErr.message);
        }
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assessment_id INT NOT NULL,
            student_user_id INT NOT NULL,
            report_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE,
            FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_reports:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS campus_notices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tpo_id INT NOT NULL,
            college_id INT NOT NULL,
            batch_name VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            category VARCHAR(50) DEFAULT 'GENERAL',
            priority VARCHAR(50) DEFAULT 'NORMAL',
            attachment_type VARCHAR(50) DEFAULT 'NONE',
            attachment_url LONGTEXT,
            attachment_name VARCHAR(255),
            attachment_size VARCHAR(50),
            is_public TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN category VARCHAR(50) DEFAULT 'GENERAL'"); } catch (e) {}
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN priority VARCHAR(50) DEFAULT 'NORMAL'"); } catch (e) {}
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN attachment_type VARCHAR(50) DEFAULT 'NONE'"); } catch (e) {}
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN attachment_url LONGTEXT"); } catch (e) {}
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN attachment_name VARCHAR(255)"); } catch (e) {}
        try { await connection.query("ALTER TABLE campus_notices ADD COLUMN attachment_size VARCHAR(50)"); } catch (e) {}
      } catch (err: any) {
        console.error("Error creating campus_notices:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS study_materials (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tpo_id INT NOT NULL,
            college_id INT NOT NULL,
            batch_name VARCHAR(100) DEFAULT 'ALL',
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100) DEFAULT 'General',
            attachment_type VARCHAR(50) NOT NULL,
            attachment_url LONGTEXT NOT NULL,
            file_name VARCHAR(255),
            file_size VARCHAR(50),
            download_count INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating study_materials:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read TINYINT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_notifications:", err.message);
      }

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS assessment_idempotency_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            operation VARCHAR(100) NOT NULL,
            idempotency_key VARCHAR(255) NOT NULL,
            request_hash VARCHAR(64) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
            assessment_id INT DEFAULT NULL,
            response_json LONGTEXT DEFAULT NULL,
            locked_at TIMESTAMP NULL DEFAULT NULL,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            failed_at TIMESTAMP NULL DEFAULT NULL,
            failure_code VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY idx_comp_op_key (company_id, operation, idempotency_key)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating assessment_idempotency_requests in MySQL:", err.message);
      }

      try { await connection.query("ALTER TABLE assessment_idempotency_requests ADD COLUMN locked_at TIMESTAMP NULL DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE assessment_idempotency_requests ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE assessment_idempotency_requests ADD COLUMN failed_at TIMESTAMP NULL DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE assessment_idempotency_requests ADD COLUMN failure_code VARCHAR(100) DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE assessment_idempotency_requests ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL"); } catch (e) {}

      // Ensure tests table exists and has assessment metadata columns on MySQL
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS tests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            company_id INT DEFAULT NULL,
            job_id INT DEFAULT NULL,
            stage_id INT DEFAULT NULL,
            cutoff_score DOUBLE DEFAULT 40,
            duration INT DEFAULT 30,
            status VARCHAR(50) DEFAULT 'PUBLISHED',
            version INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating tests table on MySQL:", err.message);
      }

      try { await connection.query("ALTER TABLE tests ADD COLUMN assessment_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN company_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN stage_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN cutoff_score DOUBLE DEFAULT 40"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN duration INT DEFAULT 30"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN status VARCHAR(50) DEFAULT 'PUBLISHED'"); } catch (e) {}
      try { await connection.query("ALTER TABLE tests ADD COLUMN version INT DEFAULT 1"); } catch (e) {}

      // Ensure test_submissions table exists and has required columns on MySQL
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            test_id INT DEFAULT NULL,
            assignment_id INT DEFAULT NULL,
            assessment_version_id INT DEFAULT NULL,
            job_id INT DEFAULT NULL,
            application_id INT DEFAULT NULL,
            score DOUBLE DEFAULT 0,
            percentage DOUBLE DEFAULT 0,
            passed TINYINT(1) DEFAULT 0,
            cutoff_score DOUBLE DEFAULT 0,
            total_marks DOUBLE DEFAULT 100,
            duration INT DEFAULT 30,
            questions_json LONGTEXT DEFAULT NULL,
            violations_count INT DEFAULT 0,
            status VARCHAR(50) DEFAULT 'SUBMITTED',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating test_submissions table on MySQL:", err.message);
      }

      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN test_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN stage_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN assignment_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN assessment_version_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN job_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN application_id INT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN attempt_number INT DEFAULT 1"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN assessment_version INT DEFAULT 1"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN questions_json LONGTEXT DEFAULT NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN percentage DOUBLE DEFAULT 0"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN passed TINYINT(1) DEFAULT 0"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN cutoff_score DOUBLE DEFAULT 0"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN total_marks DOUBLE DEFAULT 100"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN violations_count INT DEFAULT 0"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN status VARCHAR(50) DEFAULT 'SUBMITTED'"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN duration INT DEFAULT 30"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN total_questions INT DEFAULT 0"); } catch (e) {}
      try { await connection.query("ALTER TABLE test_submissions ADD COLUMN time_taken_seconds INT DEFAULT 0"); } catch (e) {}

      // Ensure test_submission_events table exists and has required columns on MySQL
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_submission_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            attempt_id INT DEFAULT NULL,
            application_id INT NOT NULL,
            student_id INT DEFAULT NULL,
            event_type VARCHAR(100) NOT NULL,
            event_data LONGTEXT DEFAULT NULL,
            idempotency_key VARCHAR(255) DEFAULT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating test_submission_events table on MySQL:", err.message);
      }

      try { await connection.query("ALTER TABLE test_submission_events ADD COLUMN attempt_id INT DEFAULT NULL"); } catch (e) {}

      // Ensure company_assessment_definitions table exists on MySQL
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS company_assessment_definitions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            questions_json LONGTEXT NOT NULL,
            duration_minutes INT DEFAULT 30,
            cutoff_score DOUBLE DEFAULT 40,
            total_marks DOUBLE DEFAULT 100,
            status VARCHAR(50) DEFAULT 'DRAFT',
            version INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating company_assessment_definitions on MySQL:", err.message);
      }

      // Ensure company_assessment_assignments table exists on MySQL
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS company_assessment_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            definition_version_id INT NOT NULL,
            job_id INT NOT NULL,
            stage_id INT DEFAULT NULL,
            cutoff_score DOUBLE DEFAULT 40,
            status VARCHAR(50) DEFAULT 'ACTIVE',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_comp_job (company_id, job_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch (err: any) {
        console.error("Error creating company_assessment_assignments on MySQL:", err.message);
      }
    }

    // Apply High-Coverage Performance Indices for MySQL
    console.log("📡 Guaranteeing database indexes are configured on MySQL...");
    try {
      if (useMySQL && pool) {
        try {
          await connection.query("CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);");
        } catch (err) { /* ignore if already exists */ }
        try {
          await connection.query("CREATE INDEX idx_student_profiles_onboarding ON student_profiles(onboarding_completed, onboarding_status);");
        } catch (err) { /* ignore if already exists */ }
        try {
          await connection.query("CREATE INDEX idx_jobs_status_created ON jobs(status, created_at DESC);");
        } catch (err) { /* ignore if already exists */ }
        try {
          await connection.query("CREATE INDEX idx_job_applications_student_job ON job_applications(student_id, job_id);");
        } catch (err) { /* ignore if already exists */ }
        try {
          await connection.query("CREATE INDEX idx_performance_stats_xp ON student_performance_stats(xp_points DESC);");
        } catch (err) { /* ignore if already exists */ }
      }
    } catch (e) { console.error("Index migration failed:", e); }

    console.log("✅ Database migration checks completed");
      } catch (err: any) {
        if (mysqlRequested) {
          console.error("================================================================================");
          console.error(`🚨 FATAL DATABASE INITIALIZATION/MIGRATION ERROR [INIT_FALLBACK]`);
          console.error(`👉 MySQL was explicitly requested but failed during connection or migration!`);
          console.error(`👉 Configured Host: ${mysqlHost || 'not set'}`);
          console.error(`👉 Configured Port: ${mysqlPort || '3306'}`);
          console.error(`👉 Configured User: ${mysqlUser || 'not set'}`);
          console.error(`👉 Configured Database: ${mysqlDatabase || 'not set'}`);
          console.error(`👉 Error Details: ${err.message || err}`);
          console.error(`👉 Action: Terminating startup to prevent running on fallback SQLite database.`);
          console.error("================================================================================");
          process.exit(1);
        }
        logSafeConnectionError(err, "INIT_FALLBACK");
        useMySQL = false;
        setupSQLite();
        return initDb(); // Re-run as SQLite
      } finally {
        if (connection) connection.release();
      }
    } else {
      await runSqliteInit(sqliteDb);
    }

  // Initialize company preferences table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_preferences (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
        email_notification_settings_json ${useMySQL ? 'JSON' : 'TEXT'} NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id)
      )
    `);
    console.log("⚙️ company_preferences table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_preferences table:", err);
  }

  // Initialize contact_inquiries table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("⚙️ contact_inquiries table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize contact_inquiries table:", err);
  }

  // Initialize company pending actions table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_pending_actions (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        created_by_user_id INT NULL,
        assigned_to_user_id INT NULL,
        source_type VARCHAR(50) DEFAULT 'MANUAL',
        entity_type VARCHAR(50) NULL,
        entity_id INT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        priority VARCHAR(20) DEFAULT 'NORMAL',
        status VARCHAR(20) DEFAULT 'PENDING',
        due_at DATETIME NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("📋 company_pending_actions table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_pending_actions table:", err);
  }

  // Initialize company todos table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_todos (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        created_by_user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        due_date VARCHAR(10) NOT NULL,
        due_time VARCHAR(10) NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("📋 company_todos table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_todos table:", err);
  }

  // Initialize company HR profiles table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_hr_profiles (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        designation VARCHAR(255) NULL,
        permissions TEXT NULL,
        role_type VARCHAR(50) DEFAULT 'SUB_HR',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      )
    `);
    console.log("👥 company_hr_profiles table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_hr_profiles table:", err);
  }

  // Initialize company job assignments table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_job_assignments (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        job_id INT NOT NULL,
        assigned_hr_user_id INT NOT NULL,
        assigned_by_user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("📋 company_job_assignments table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_job_assignments table:", err);
  }

  // Initialize company application assignments table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_application_assignments (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        job_id INT NOT NULL,
        application_id INT NOT NULL,
        assigned_hr_user_id INT NOT NULL,
        assigned_by_user_id INT NOT NULL,
        assignment_type VARCHAR(50) DEFAULT 'MANUAL',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("📋 company_application_assignments table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_application_assignments table:", err);
  }

  // Initialize company audit logs table
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS company_audit_logs (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        actor_user_id INT NOT NULL,
        actor_name VARCHAR(255) NOT NULL,
        actor_role VARCHAR(50) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        target_type VARCHAR(100) NULL,
        target_id INT NULL,
        metadata_json ${useMySQL ? 'JSON' : 'TEXT'} NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("🧾 company_audit_logs table initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company_audit_logs table:", err);
  }

  // Initialize company drops and media tables
  try {
    await performQuery(`
      CREATE TABLE IF NOT EXISTS drops (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NOT NULL,
        job_id INT DEFAULT NULL,
        created_by_user_id INT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        custom_label VARCHAR(100) DEFAULT NULL,
        description TEXT NOT NULL,
        location VARCHAR(255) DEFAULT NULL,
        scheduled_at DATETIME DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        views_count INT DEFAULT 0,
        likes_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        shares_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await performQuery(`ALTER TABLE drops ADD COLUMN custom_label VARCHAR(100) DEFAULT NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drops ADD COLUMN created_by_user_id INT NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drops ADD COLUMN likes_count INT DEFAULT 0`); } catch (e) {}

    await performQuery(`
      CREATE TABLE IF NOT EXISTS drop_views (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        drop_id INT NOT NULL,
        viewer_user_id INT NOT NULL,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(drop_id, viewer_user_id)
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS drop_likes (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        drop_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(drop_id, user_id)
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS drop_comments (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        drop_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        parent_comment_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS drop_media (
        id INTEGER PRIMARY KEY ${useMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT'},
        company_id INT NULL,
        drop_id INT NULL DEFAULT NULL,
        uploaded_by_user_id INT NULL DEFAULT NULL,
        storage_key VARCHAR(255) NULL,
        sanitized_original_name VARCHAR(255) NULL,
        file_url VARCHAR(500) NULL,
        file_name VARCHAR(255) NULL,
        mime_type VARCHAR(100) NULL,
        size_bytes INT DEFAULT 0,
        width INT DEFAULT 0,
        height INT DEFAULT 0,
        content_hash VARCHAR(64) NULL,
        moderation_status VARCHAR(20) DEFAULT 'PENDING',
        moderation_reason_code VARCHAR(50) DEFAULT 'SAFE',
        moderation_provider VARCHAR(50) DEFAULT 'GEMINI',
        moderation_model VARCHAR(50) DEFAULT 'gemini-2.5-flash',
        moderated_at DATETIME NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Idempotent column additions for drop_media
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN company_id INT NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN uploaded_by_user_id INT NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN storage_key VARCHAR(255) NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN sanitized_original_name VARCHAR(255) NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN mime_type VARCHAR(100) NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN size_bytes INT DEFAULT 0`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN width INT DEFAULT 0`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN height INT DEFAULT 0`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN content_hash VARCHAR(64) NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'PENDING'`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN moderation_reason_code VARCHAR(50) DEFAULT 'SAFE'`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN moderation_provider VARCHAR(50) DEFAULT 'GEMINI'`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN moderation_model VARCHAR(50) DEFAULT 'gemini-2.5-flash'`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN moderated_at DATETIME NULL`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING'`); } catch (e) {}
    try { await performQuery(`ALTER TABLE drop_media ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (e) {}

    // Indexes for query performance
    try { await performQuery(`CREATE INDEX idx_drop_media_company ON drop_media(company_id)`); } catch (e) {}
    try { await performQuery(`CREATE INDEX idx_drop_media_drop ON drop_media(drop_id)`); } catch (e) {}
    try { await performQuery(`CREATE INDEX idx_drop_media_status ON drop_media(status)`); } catch (e) {}
    try { await performQuery(`CREATE INDEX idx_drop_media_mod_status ON drop_media(moderation_status)`); } catch (e) {}
    try { await performQuery(`CREATE INDEX idx_drops_company_status ON drops(company_id, status)`); } catch (e) {}

    console.log("📢 company drops and media tables initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize company drops tables:", err);
  }

  // Seed Default Super Admin
  const adminEmail = "admin@vega.com";
  const [admins]: any = await performQuery("SELECT * FROM users WHERE email = ?", [adminEmail]);
  if (admins.length === 0) {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash("admin123", 10);
    await performQuery("INSERT INTO users (email, password_hash, role, is_verified) VALUES (?, ?, ?, 1)", [adminEmail, hash, "SUPER_ADMIN"]);
    console.log("👤 Default Super Admin created: admin@vega.com / admin123");
  }

  // Seed Default Approved Company
  const companyEmail = "company@vega.com";
  const [companies]: any = await performQuery("SELECT * FROM users WHERE email = ?", [companyEmail]);
  if (companies.length === 0) {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash("company123", 10);
    // Insert into users
    await performQuery("INSERT INTO users (email, password_hash, role, is_verified) VALUES (?, ?, ?, 1)", [companyEmail, hash, "COMPANY"]);
    
    // Get the user ID
    const [companyUser]: any = await performQuery("SELECT id FROM users WHERE email = ?", [companyEmail]);
    const companyUserId = companyUser[0].id;
    
    // Insert into company_profiles with APPROVED status
    await performQuery(`
      INSERT INTO company_profiles (
        user_id, company_name, status, completeness_score, is_submitted, verified_at,
        website, company_email, contact_number, company_type, industry, company_size,
        year_established, business_name, gst_no, cin_no, pan_no, address, operating_address,
        country, state, city, about, services, linkedin_url, github_url
      ) VALUES (
        ?, ?, 'APPROVED', 100, 1, CURRENT_TIMESTAMP,
        'https://google.com', 'hr@vega.com', '9876543210', 'Private Limited', 'Information Technology', '500-1000',
        2015, 'Google Inc', '27AAAAA1111A1Z1', 'L01110MH2015PLC012345', 'ABCDE1234F', '1600 Amphitheatre Pkwy', '1600 Amphitheatre Pkwy',
        'India', 'Maharashtra', 'Mumbai', 'Leading tech solution company provider.', 'AI, Cloud, Database Solutions', 'https://linkedin.com', 'https://github.com'
      )
    `, [companyUserId, "Google Recruiting Team"]);
    console.log("🏢 Default approved company created: company@vega.com / company123");
  }

  // Seed Default System Configs
  try {
    await performQuery("DELETE FROM system_configs WHERE config_key = 'QUIZ_GENERATION_COST'");
  } catch (err) {
    console.error("Failed to delete legacy config key:", err);
  }

  const [existingConfigs]: any = await performQuery("SELECT COUNT(*) as count FROM system_configs");
  const configCount = existingConfigs[0]?.count || 0;
  
  const defaultConfigValues = [
    { key: 'DAILY_REWARD_BASE', value: '50', desc: 'Base daily login reward in XP' },
    { key: 'STREAK_BONUS_STEP', value: '10', desc: 'Bonus XP added for active stream step' },
    { key: 'REFERRAL_REWARD', value: '60', desc: 'XP points given to referrer' },
    { key: 'MOCK_INTERVIEW_COST', value: '125', desc: 'XP deducted to attempt mock interview' },
    { key: 'RESUME_ANALYSIS_COST', value: '50', desc: 'XP deducted to create resume draft' },
    { key: 'XP_PER_RUPEE', value: '5', desc: 'Conversion rate of XP points per 1 INR' },
    { key: 'COMMUNITY_POST_XP_REWARD_BASE', value: '10', desc: 'Base XP rewarded for publishing an experience article' },
    { key: 'COMMUNITY_POST_XP_REWARD_HIGH_SCORE', value: '15', desc: 'High quality content XP bonus (Score >= 90)' },
    { key: 'COMMUNITY_LIKE_XP_REWARD', value: '1', desc: 'XP rewarded to author per post like' },
    { key: 'COMMUNITY_COMMENT_XP_REWARD', value: '2', desc: 'XP rewarded to author per comment' },
    { key: 'COMMUNITY_UNLOCK_XP_REWARD', value: '5', desc: 'XP rewarded to author per premium unlock purchase' },
    { key: 'QUIZ_QUESTION_COST', value: '5', desc: 'XP deducted per dynamic AI quiz question' },
  ];

  if (configCount === 0) {
    console.log("🌱 Seeding default system configurations...");
    for (const item of defaultConfigValues) {
      await performQuery(
        "INSERT INTO system_configs (config_key, config_value, description) VALUES (?, ?, ?)",
        [item.key, item.value, item.desc]
      );
    }
  } else {
    // Standalone check to guarantee new parameters are active on already-initialized databases
    for (const item of defaultConfigValues) {
      const [found]: any = await performQuery("SELECT * FROM system_configs WHERE config_key = ?", [item.key]);
      if (found.length === 0) {
        await performQuery(
          "INSERT INTO system_configs (config_key, config_value, description) VALUES (?, ?, ?)",
          [item.key, item.value, item.desc]
        );
        console.log(`🌱 Seeded missing configuration: ${item.key}`);
      }
    }
  }

  // Migrate existing xp_packages if needed
  try {
    await performQuery("ALTER TABLE xp_packages ADD COLUMN mock_interviews_included INT DEFAULT NULL");
  } catch (err) { /* column may exist */ }
  try {
    await performQuery("ALTER TABLE xp_packages ADD COLUMN resume_reviews_included INT DEFAULT NULL");
  } catch (err) { /* column may exist */ }

  // Seed Default XP Packages
  const [existingPackages]: any = await performQuery("SELECT COUNT(*) as count FROM xp_packages");
  const pkgCount = existingPackages[0]?.count || 0;
  if (pkgCount === 0) {
    console.log("🌱 Seeding default XP packages...");
    const defaultPackages = [
      { name: 'Starter Pack', xp: 500, price: 99, popular: 0, bestValue: 0, mock: 4, resume: 10 },
      { name: 'Value Pack', xp: 1200, price: 199, popular: 1, bestValue: 0, mock: 9, resume: 24 },
      { name: 'Elite Pack', xp: 2500, price: 399, popular: 0, bestValue: 1, mock: 20, resume: 50 }
    ];
    for (const pkg of defaultPackages) {
      await performQuery(
        "INSERT INTO xp_packages (name, xp_amount, price_inr, is_popular, is_best_value, mock_interviews_included, resume_reviews_included) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [pkg.name, pkg.xp, pkg.price, pkg.popular, pkg.bestValue, pkg.mock, pkg.resume]
      );
    }
  } else {
    // Backfill any existing packages that have null fields
    try {
      await performQuery("UPDATE xp_packages SET mock_interviews_included = CAST(xp_amount / 125 AS SIGNED) WHERE mock_interviews_included IS NULL");
      await performQuery("UPDATE xp_packages SET resume_reviews_included = CAST(xp_amount / 50 AS SIGNED) WHERE resume_reviews_included IS NULL");
    } catch (sqliteErr) {
      try {
        await performQuery("UPDATE xp_packages SET mock_interviews_included = CAST(xp_amount / 125 AS INTEGER) WHERE mock_interviews_included IS NULL");
        await performQuery("UPDATE xp_packages SET resume_reviews_included = CAST(xp_amount / 50 AS INTEGER) WHERE resume_reviews_included IS NULL");
      } catch (e) {
        console.error("Failed to backfill package limits:", e);
      }
    }
  }

  // Community DB setup
  try {
    const isMysql = useMySQL;
    const pkType = isMysql ? "INT PRIMARY KEY AUTO_INCREMENT" : "INTEGER PRIMARY KEY AUTOINCREMENT";
    const textBlobType = "TEXT";
    const mediaBlobType = isMysql ? "LONGTEXT" : "TEXT";
    
    await performQuery(`
      CREATE TABLE IF NOT EXISTS posts (
        id ${pkType},
        user_id INT NOT NULL,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content ${textBlobType} NOT NULL,
        preview_text ${textBlobType} NOT NULL,
        xp_unlock_cost INT DEFAULT 0,
        company_name VARCHAR(100) DEFAULT NULL,
        is_verified TINYINT DEFAULT 0,
        author_role VARCHAR(50) DEFAULT 'STUDENT',
        author_badge VARCHAR(100) DEFAULT NULL,
        content_score INT DEFAULT 80,
        quality_analysis ${textBlobType} DEFAULT NULL,
        tags VARCHAR(255) DEFAULT '',
        likes_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        unlock_count INT DEFAULT 0,
        proof_url VARCHAR(255) DEFAULT NULL,
        image_url ${mediaBlobType} DEFAULT NULL,
        video_url ${mediaBlobType} DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await performQuery(`ALTER TABLE posts ADD COLUMN image_url ${mediaBlobType} DEFAULT NULL`);
    } catch (e) { /* column may exist */ }
    try {
      await performQuery(`ALTER TABLE posts ADD COLUMN video_url ${mediaBlobType} DEFAULT NULL`);
    } catch (e) { /* column may exist */ }

    await performQuery(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id ${pkType},
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id ${pkType},
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment ${textBlobType} NOT NULL,
        parent_comment_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS unlocked_posts (
        id ${pkType},
        user_id INT NOT NULL,
        post_id INT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id ${pkType},
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await performQuery(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id ${pkType},
        follower_id INT NOT NULL,
        following_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clean up seeded demo batches to ensure "no static data"
    try {
      await performQuery(`DELETE FROM assessment_batches WHERE batch_name IN ('CS-2024', 'IT-2024', 'ECE-2024')`);
      console.log("🧹 Cleaned up demo batches from assessment_batches table.");
    } catch (e) {}

    try {
      await performQuery(`ALTER TABLE test_submissions ADD COLUMN stage_id INT`);
    } catch (e) {}
    try {
      await performQuery(`ALTER TABLE test_submissions ADD COLUMN assessment_version INT DEFAULT 1`);
    } catch (e) {}
    try {
      await performQuery(`ALTER TABLE test_submissions ADD COLUMN answers_json TEXT`);
    } catch (e) {}

    console.log("🚀 Custom Community Tables Initialized Successfully.");
  } catch (err) {
    console.error("❌ Error setting up Community tables:", err);
  }

  // Assessment Database Preflight Verification (Company & TPO separated)
  const preflight = await ensureAssessmentSchema();
  if (!preflight.ready) {
    console.error("❌ Assessment database schema initialization failed. Missing elements:", preflight.missing);
    throw new Error(`Assessment database schema initialization failed: missing ${preflight.missing.join(', ')}`);
  } else {
    console.log("✅ Company Assessment database schema preflight verified successfully.");
  }

  const tpoPreflight = await ensureTPOAssessmentSchema();
  if (!tpoPreflight.ready) {
    console.error("❌ TPO Assessment database schema initialization failed. Missing elements:", tpoPreflight.missing);
    throw new Error(`TPO Assessment database schema initialization failed: missing ${tpoPreflight.missing.join(', ')}`);
  } else {
    console.log("✅ TPO Assessment database schema preflight verified successfully.");
  }
}

export async function ensureAssessmentSchema(): Promise<{ ready: boolean; missing: string[] }> {
  const missing: string[] = [];

  try {
    if (useMySQL && pool) {
      const requiredTables = [
        'company_assessment_definitions',
        'company_assessment_assignments',
        'test_submissions',
        'test_submission_events',
        'assessment_idempotency_requests'
      ];

      for (const tbl of requiredTables) {
        const [rows]: any = await pool.query("SHOW TABLES LIKE ?", [tbl]);
        if (!rows || rows.length === 0) {
          missing.push(`table:${tbl}`);
        }
      }

      if (!missing.includes('table:company_assessment_definitions')) {
        const [cols]: any = await pool.query("DESCRIBE `company_assessment_definitions`");
        const colNames = cols.map((c: any) => c.Field);
        const reqCols = ['company_id', 'title', 'questions_json', 'duration_minutes', 'cutoff_score', 'total_marks', 'status', 'version'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:company_assessment_definitions.${c}`);
          }
        }
      }

      if (!missing.includes('table:company_assessment_assignments')) {
        const [cols]: any = await pool.query("DESCRIBE `company_assessment_assignments`");
        const colNames = cols.map((c: any) => c.Field);
        const reqCols = ['company_id', 'definition_version_id', 'job_id', 'stage_id', 'cutoff_score', 'status'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:company_assessment_assignments.${c}`);
          }
        }
      }

      if (!missing.includes('table:assessment_idempotency_requests')) {
        const [cols]: any = await pool.query("DESCRIBE `assessment_idempotency_requests`");
        const colNames = cols.map((c: any) => c.Field);
        const reqCols = ['company_id', 'operation', 'idempotency_key', 'request_hash', 'status', 'response_json', 'locked_at', 'completed_at', 'failed_at', 'failure_code'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:assessment_idempotency_requests.${c}`);
          }
        }

        const [idxRows]: any = await pool.query("SHOW INDEX FROM `assessment_idempotency_requests` WHERE Key_name = 'idx_comp_op_key'");
        if (!idxRows || idxRows.length === 0) {
          missing.push('index:assessment_idempotency_requests.idx_comp_op_key');
        }
      }

      if (!missing.includes('table:test_submissions')) {
        const [subCols]: any = await pool.query("DESCRIBE `test_submissions`");
        const subColNames = subCols.map((c: any) => c.Field);
        const reqSubCols = ['questions_json', 'cutoff_score', 'total_marks', 'duration', 'assignment_id'];
        for (const sc of reqSubCols) {
          if (!subColNames.includes(sc)) {
            missing.push(`column:test_submissions.${sc}`);
          }
        }
      }

      if (!missing.includes('table:test_submission_events')) {
        const [evtCols]: any = await pool.query("DESCRIBE `test_submission_events`");
        const evtColNames = evtCols.map((c: any) => c.Field);
        if (!evtColNames.includes('attempt_id')) {
          missing.push('column:test_submission_events.attempt_id');
        }
      }
    } else {
      if (!sqliteDb) {
        setupSQLite();
      }
      const requiredTables = [
        'company_assessment_definitions',
        'company_assessment_assignments',
        'test_submissions',
        'test_submission_events',
        'assessment_idempotency_requests'
      ];

      for (const tbl of requiredTables) {
        const row = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tbl);
        if (!row) {
          missing.push(`table:${tbl}`);
        }
      }

      if (!missing.includes('table:company_assessment_definitions')) {
        const cols: any = sqliteDb.prepare("PRAGMA table_info(company_assessment_definitions)").all();
        const colNames = cols.map((c: any) => c.name);
        const reqCols = ['company_id', 'title', 'questions_json', 'duration_minutes', 'cutoff_score', 'total_marks', 'status', 'version'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:company_assessment_definitions.${c}`);
          }
        }
      }

      if (!missing.includes('table:company_assessment_assignments')) {
        const cols: any = sqliteDb.prepare("PRAGMA table_info(company_assessment_assignments)").all();
        const colNames = cols.map((c: any) => c.name);
        const reqCols = ['company_id', 'definition_version_id', 'job_id', 'stage_id', 'cutoff_score', 'status'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:company_assessment_assignments.${c}`);
          }
        }
      }

      if (!missing.includes('table:assessment_idempotency_requests')) {
        const cols: any = sqliteDb.prepare("PRAGMA table_info(assessment_idempotency_requests)").all();
        const colNames = cols.map((c: any) => c.name);
        const reqCols = ['company_id', 'operation', 'idempotency_key', 'request_hash', 'status', 'response_json', 'locked_at', 'completed_at', 'failed_at', 'failure_code'];
        for (const c of reqCols) {
          if (!colNames.includes(c)) {
            missing.push(`column:assessment_idempotency_requests.${c}`);
          }
        }
      }

      if (!missing.includes('table:test_submissions')) {
        const cols: any = sqliteDb.prepare("PRAGMA table_info(test_submissions)").all();
        const colNames = cols.map((c: any) => c.name);
        const reqSubCols = ['questions_json', 'cutoff_score', 'total_marks', 'duration', 'assignment_id'];
        for (const sc of reqSubCols) {
          if (!colNames.includes(sc)) {
            missing.push(`column:test_submissions.${sc}`);
          }
        }
      }

      if (!missing.includes('table:test_submission_events')) {
        const cols: any = sqliteDb.prepare("PRAGMA table_info(test_submission_events)").all();
        const colNames = cols.map((c: any) => c.name);
        if (!colNames.includes('attempt_id')) {
          missing.push('column:test_submission_events.attempt_id');
        }
      }
    }
  } catch (err: any) {
    missing.push(`error:${err.message}`);
  }

  return { ready: missing.length === 0, missing };
}

export async function ensureTPOAssessmentSchema(): Promise<{ ready: boolean; missing: string[] }> {
  const missing: string[] = [];
  const requiredTables = [
    'assessment_tests',
    'assessment_questions',
    'assessment_attempts',
    'assessment_answers',
    'assessment_violations',
    'assessment_reports'
  ];

  try {
    if (useMySQL && pool) {
      for (const tbl of requiredTables) {
        const [rows]: any = await pool.query("SHOW TABLES LIKE ?", [tbl]);
        if (!rows || rows.length === 0) {
          missing.push(`table:${tbl}`);
        }
      }
    } else {
      if (!sqliteDb) {
        setupSQLite();
      }
      for (const tbl of requiredTables) {
        const row = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tbl);
        if (!row) {
          missing.push(`table:${tbl}`);
        }
      }
    }
  } catch (err: any) {
    missing.push(`error:${err.message}`);
  }

  return { ready: missing.length === 0, missing };
}



export default db;
