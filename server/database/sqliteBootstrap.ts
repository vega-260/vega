// Development-only SQLite schema bootstrap. Production never uses this module.
export async function runSqliteInit(sqliteDb: any) {
  
  // Standard tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      is_verified INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL,
      xp_balance INTEGER DEFAULT 0,
      free_mock_count INTEGER DEFAULT 3,
      referral_code TEXT UNIQUE,
      last_reward_claimed_at DATETIME DEFAULT NULL,
      login_streak INTEGER DEFAULT 0,
      total_earned_xp INTEGER DEFAULT 0,
      total_spent_xp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS xp_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL,
      reward_given INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      razorpay_order_id TEXT NOT NULL,
      razorpay_payment_id TEXT,
      amount REAL NOT NULL,
      xp_added INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      preferences TEXT,
      weak_skills TEXT,
      goals TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      college_id INTEGER,
      full_name TEXT,
      bio TEXT,
      dob DATE,
      gender TEXT,
      address TEXT,
      profile_photo_url TEXT,
      aadhar_or_college_id TEXT,
      contact TEXT,
      experience_type TEXT DEFAULT 'FRESHER',
      headline TEXT,
      location TEXT,
      preferred_job_role TEXT,
      preferred_location TEXT,
      availability TEXT,
      education_json TEXT, 
      experience_json TEXT,
      projects_json TEXT,
      skills_json TEXT,
      languages_json TEXT,
      social_links_json TEXT,
      resume_url TEXT,
      resume_builder_json TEXT, 
      completeness_score INTEGER DEFAULT 0,
      email_verified INTEGER DEFAULT 0,
      phone_verified INTEGER DEFAULT 0,
      onboarding_completed INTEGER DEFAULT 0,
      onboarding_industry TEXT,
      onboarding_status TEXT,
      onboarding_source TEXT,
      onboarding_help_actions TEXT,
      batch TEXT,
      country TEXT,
      last_resume_reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      daily_resume_count INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      logo_url TEXT,
      website TEXT,
      company_email TEXT,
      contact_number TEXT,
      company_type TEXT,
      industry TEXT,
      company_size TEXT,
      year_established INTEGER,
      registration_date TEXT,
      business_name TEXT,
      gst_no TEXT UNIQUE,
      cin_no TEXT UNIQUE,
      pan_no TEXT UNIQUE,
      address TEXT,
      operating_address TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      about TEXT,
      services TEXT,
      linkedin_url TEXT,
      github_url TEXT,
      status TEXT DEFAULT 'PENDING',
      rejection_reason TEXT,
      completeness_score INTEGER DEFAULT 0,
      is_submitted INTEGER DEFAULT 0,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TPO & COLLEGE MANAGEMENT TABLES
    CREATE TABLE IF NOT EXISTS college_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_name TEXT NOT NULL,
      college_code TEXT UNIQUE NOT NULL,
      university TEXT,
      address TEXT,
      district TEXT,
      state TEXT,
      website TEXT,
      contact_number TEXT,
      country TEXT DEFAULT 'India',
      official_email TEXT,
      principal_name TEXT,
      placement_head TEXT,
      college_logo TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      batch_name TEXT NOT NULL,
      department TEXT,
      academic_year TEXT,
      semester TEXT,
      strength INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      assigned_tpo_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      batch_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT DEFAULT 'SENT',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tpo_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      contact_number TEXT,
      designation TEXT,
      status TEXT DEFAULT 'ACTIVE',
      first_login INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tpo_colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tpo_id INTEGER NOT NULL,
      college_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tpo_id, college_id),
      FOREIGN KEY (tpo_id) REFERENCES tpo_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tpo_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_url TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      rejection_reason TEXT,
      verified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      tpo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      location_or_link TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'UPCOMING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE,
      FOREIGN KEY (tpo_id) REFERENCES tpo_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS placement_drives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER UNIQUE NOT NULL,
      company_name TEXT,
      job_role TEXT,
      eligibility_criteria TEXT,
      package_details TEXT,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT DEFAULT 'REGISTERED',
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, student_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS college_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER UNIQUE NOT NULL,
      total_students INTEGER DEFAULT 0,
      placed_students INTEGER DEFAULT 0,
      avg_talent_score REAL DEFAULT 0,
      avg_coding_score REAL DEFAULT 0,
      avg_interview_score REAL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tpo_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tpo_id INTEGER NOT NULL,
      college_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      total_marks INTEGER DEFAULT 100,
      questions_json TEXT NOT NULL, -- Array of {question, options, correct, weight}
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tpo_id) REFERENCES tpo_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES college_master(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_test_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      test_id INTEGER NOT NULL,
      score_obtained REAL DEFAULT 0,
      time_taken_minutes INTEGER,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES tpo_tests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS company_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      doc_url TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      skills_json TEXT NOT NULL,
      location TEXT,
      job_type TEXT,
      experience_level TEXT,
      salary_range TEXT,
      education_requirement TEXT,
      responsibilities TEXT,
      qualifications TEXT,
      additional_notes TEXT,
      application_start_date DATE,
      deadline DATE,
      openings INTEGER DEFAULT 1,
      status TEXT DEFAULT 'OPEN',
      ended_at DATETIME DEFAULT NULL,
      end_reminder_sent_at DATETIME DEFAULT NULL,
      pipeline_ended_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      stage_type TEXT DEFAULT 'APPLICATION',
      stage_order INTEGER NOT NULL,
      description TEXT,
      config_json TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer TEXT,
      FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      current_stage_id INTEGER,
      status TEXT DEFAULT 'APPLIED',
      rejection_stage_id INTEGER,
      rejection_feedback TEXT,
      rejected_at DATETIME,
      rejected_by_user_id INTEGER,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, job_id),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (current_stage_id) REFERENCES job_stages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_id INTEGER DEFAULT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT DEFAULT NULL,
      scheduled_at DATETIME DEFAULT NULL,
      status TEXT DEFAULT 'ACTIVE',
      views_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS test_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      answers_json TEXT,
      score REAL,
      status TEXT DEFAULT 'COMPLETED',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      interview_type TEXT,
      location_or_link TEXT,
      scheduled_at DATETIME,
      notes TEXT,
      FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS application_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      stage_id INTEGER,
      action TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_id) REFERENCES job_stages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL,
      questions_json TEXT NOT NULL, 
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resume_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_id TEXT NOT NULL,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      transcript_json TEXT,
      score INTEGER,
      communication_score INTEGER,
      confidence_score INTEGER,
      explanation_score INTEGER,
      presentation_score INTEGER,
      knowledge_score INTEGER,
      feedback TEXT,
      strengths_json TEXT,
      weaknesses_json TEXT,
      tips_json TEXT,
      questions_answers_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_performance_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      resume_score INTEGER DEFAULT 0,
      avg_interview_score REAL DEFAULT 0,
      skill_count INTEGER DEFAULT 0,
      xp_points INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS talent_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      overall_score INTEGER DEFAULT 0,
      breakdown_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extracurricular_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      organization_name TEXT,
      participation_level TEXT,
      achievement_rank TEXT,
      activity_date DATE,
      certificate_url TEXT,
      ai_analysis_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leadership_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      leadership_score INTEGER DEFAULT 0,
      ai_feedback TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      streak_days INTEGER DEFAULT 0,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      consistency_score INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      action TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_date DATE NOT NULL,
      is_check_in_completed INTEGER DEFAULT 0,
      is_interview_completed INTEGER DEFAULT 0,
      is_profile_updated INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      UNIQUE(user_id, task_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge_name TEXT NOT NULL,
      badge_type TEXT DEFAULT 'BEGINNER',
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      institution TEXT NOT NULL,
      degree TEXT NOT NULL,
      field_of_study TEXT,
      start_date DATE,
      end_date DATE,
      grade TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tech_stack TEXT,
      link TEXT,
      github_link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_experience (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      location TEXT,
      start_date DATE,
      end_date DATE,
      is_current INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      issuing_organization TEXT NOT NULL,
      issue_date DATE,
      expiry_date DATE,
      credential_id TEXT,
      credential_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_sidebar_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      allowed_pages TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS psychometric_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      trait TEXT,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS psychometric_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'STARTED',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      violation_count INTEGER DEFAULT 0,
      tab_switches INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS psychometric_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      attempt_id INTEGER NOT NULL,
      overall_score REAL,
      traits_json TEXT,
      personality_type TEXT,
      behavioral_summary TEXT,
      recommendation_tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (attempt_id) REFERENCES psychometric_attempts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS psychometric_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      violation_type TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES psychometric_attempts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accessibility_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      accessibility_mode INTEGER DEFAULT 0,
      voice_enabled INTEGER DEFAULT 0,
      contrast_mode TEXT DEFAULT 'NORMAL',
      font_size TEXT DEFAULT 'MEDIUM',
      last_used_voice TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      command TEXT NOT NULL,
      intent TEXT,
      confidence REAL,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pq_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      category TEXT,
      weight INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS iq_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      answer TEXT NOT NULL,
      difficulty TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eq_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      emotional_trait TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sq_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      social_trait TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_assessment_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      pq_score INTEGER,
      iq_score INTEGER,
      eq_score INTEGER,
      sq_score INTEGER,
      pq_details_json TEXT,
      iq_details_json TEXT,
      eq_details_json TEXT,
      sq_details_json TEXT,
      ai_behavioral_summary TEXT,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_assistant_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      preferences_json TEXT,
      recent_actions_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT,
      level TEXT,
      techstack TEXT,
      focus TEXT,
      difficulty TEXT,
      communication TEXT,
      score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'IN_PROGRESS',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      difficulty TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer TEXT,
      ai_feedback TEXT,
      score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_type TEXT,
      role TEXT,
      skills TEXT,
      difficulty TEXT,
      total_questions INTEGER,
      score INTEGER DEFAULT 0,
      percentage REAL DEFAULT 0,
      violations INTEGER DEFAULT 0,
      status TEXT DEFAULT 'GENERATING',
      ai_feedback TEXT,
      strengths_json TEXT,
      weaknesses_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      user_answer TEXT,
      is_correct BOOLEAN,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coding_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      username TEXT NOT NULL,
      is_verified INTEGER DEFAULT 1,
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, platform),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coding_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER UNIQUE NOT NULL,
      problems_solved INTEGER DEFAULT 0,
      contest_rating INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      difficulty_breakdown_json TEXT,
      topics_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES coding_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coding_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      coding_score INTEGER DEFAULT 0,
      strengths_json TEXT,
      weaknesses_json TEXT,
      ai_feedback TEXT,
      recommendations_json TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_configs (
      config_key TEXT PRIMARY KEY,
      config_value TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS xp_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      xp_amount INTEGER NOT NULL,
      price_inr INTEGER NOT NULL,
      is_popular INTEGER DEFAULT 0,
      is_best_value INTEGER DEFAULT 0,
      mock_interviews_included INTEGER DEFAULT NULL,
      resume_reviews_included INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_visibility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER UNIQUE NOT NULL,
      visibility TEXT DEFAULT 'PUBLIC',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profile_comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      type TEXT DEFAULT 'BASIC',
      xp_spent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comparison_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      compared_student_id INTEGER NOT NULL,
      comparison_type TEXT NOT NULL,
      xp_spent INTEGER DEFAULT 0,
      gap_analysis_json TEXT,
      roadmap_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS career_gap_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      gap_analysis_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_roadmaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      roadmap_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recommendation_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      student_user_id INTEGER NOT NULL,
      match_score INTEGER,
      matched_skills_json TEXT,
      recommendation_reason TEXT,
      notification_status TEXT DEFAULT 'SENT',
      notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Extra migrations/checks for SQLite
  try {
    const recNotifCols = sqliteDb.prepare("PRAGMA table_info(recommendation_notifications)").all();
    const recNotifColNames = recNotifCols.map((c: any) => c.name);
    if (!recNotifColNames.includes("matched_skills_json")) sqliteDb.exec("ALTER TABLE recommendation_notifications ADD COLUMN matched_skills_json TEXT");
    if (!recNotifColNames.includes("recommendation_reason")) sqliteDb.exec("ALTER TABLE recommendation_notifications ADD COLUMN recommendation_reason TEXT");
    if (!recNotifColNames.includes("notification_status")) sqliteDb.exec("ALTER TABLE recommendation_notifications ADD COLUMN notification_status TEXT DEFAULT 'SENT'");
    const studentCols = sqliteDb.prepare("PRAGMA table_info(student_profiles)").all();
    const studentColNames = studentCols.map((c: any) => c.name);
    if (!studentColNames.includes("college_id")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN college_id INTEGER");
    
    const collegeCols = sqliteDb.prepare("PRAGMA table_info(college_master)").all();
    const collegeColNames = collegeCols.map((c: any) => c.name);
    if (!collegeColNames.includes("status")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN status TEXT DEFAULT 'ACTIVE'");

    if (!studentColNames.includes("headline")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN headline TEXT");
    if (!studentColNames.includes("location")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN location TEXT");
    if (!studentColNames.includes("preferred_job_role")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN preferred_job_role TEXT");
    if (!studentColNames.includes("preferred_location")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN preferred_location TEXT");
    if (!studentColNames.includes("availability")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN availability TEXT");
    if (!studentColNames.includes("onboarding_completed")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN onboarding_completed INTEGER DEFAULT 0");
    if (!studentColNames.includes("onboarding_industry")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN onboarding_industry TEXT");
    if (!studentColNames.includes("onboarding_status")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN onboarding_status TEXT");
    if (!studentColNames.includes("onboarding_source")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN onboarding_source TEXT");
    if (!studentColNames.includes("onboarding_help_actions")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN onboarding_help_actions TEXT");
    if (!studentColNames.includes("batch")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN batch TEXT");
    if (!studentColNames.includes("tb_id")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN tb_id TEXT DEFAULT NULL");
    if (!studentColNames.includes("profile_visibility")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN profile_visibility TEXT DEFAULT 'PUBLIC'");
    if (!studentColNames.includes("is_placed")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN is_placed INTEGER DEFAULT 0");
    if (!studentColNames.includes("placed_company")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN placed_company TEXT DEFAULT NULL");
    if (!studentColNames.includes("is_top_performer")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN is_top_performer INTEGER DEFAULT 0");
    if (!studentColNames.includes("country")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN country TEXT");
    if (!studentColNames.includes("batch_id")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN batch_id INTEGER");
    if (!studentColNames.includes("aadhar_or_college_id")) sqliteDb.exec("ALTER TABLE student_profiles ADD COLUMN aadhar_or_college_id TEXT");

    const tpoCols = sqliteDb.prepare("PRAGMA table_info(tpo_profiles)").all();
    const tpoColNames = tpoCols.map((c: any) => c.name);
    if (!tpoColNames.includes("employee_id")) sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN employee_id TEXT");
    if (!tpoColNames.includes("phone")) sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN phone TEXT");

    const collegeCheckCols2 = sqliteDb.prepare("PRAGMA table_info(college_master)").all();
    const collegeCheckColNames2 = collegeCheckCols2.map((c: any) => c.name);
    if (!collegeCheckColNames2.includes("country")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN country TEXT DEFAULT 'India'");
    if (!collegeCheckColNames2.includes("official_email")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN official_email TEXT");
    if (!collegeCheckColNames2.includes("principal_name")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN principal_name TEXT");
    if (!collegeCheckColNames2.includes("placement_head")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN placement_head TEXT");
    if (!collegeCheckColNames2.includes("college_logo")) sqliteDb.exec("ALTER TABLE college_master ADD COLUMN college_logo TEXT");
    
    const userCols = sqliteDb.prepare("PRAGMA table_info(users)").all();
    const userColNames = userCols.map((c: any) => c.name);
    if (!userColNames.includes("xp_balance")) sqliteDb.exec("ALTER TABLE users ADD COLUMN xp_balance INTEGER DEFAULT 0");
    if (!userColNames.includes("free_mock_count")) sqliteDb.exec("ALTER TABLE users ADD COLUMN free_mock_count INTEGER DEFAULT 3");
    if (!userColNames.includes("referral_code")) sqliteDb.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
    if (!userColNames.includes("last_reward_claimed_at")) sqliteDb.exec("ALTER TABLE users ADD COLUMN last_reward_claimed_at DATETIME DEFAULT NULL");
    if (!userColNames.includes("login_streak")) sqliteDb.exec("ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0");
    if (!userColNames.includes("total_earned_xp")) sqliteDb.exec("ALTER TABLE users ADD COLUMN total_earned_xp INTEGER DEFAULT 0");
    if (!userColNames.includes("total_spent_xp")) sqliteDb.exec("ALTER TABLE users ADD COLUMN total_spent_xp INTEGER DEFAULT 0");

    const interviewHistoryCols = sqliteDb.prepare("PRAGMA table_info(interview_history)").all();
    const interviewHistoryColNames = interviewHistoryCols.map((c: any) => c.name);
    if (!interviewHistoryColNames.includes("questions_answers_json")) {
      sqliteDb.exec("ALTER TABLE interview_history ADD COLUMN questions_answers_json TEXT");
    }

    const eventCols = sqliteDb.prepare("PRAGMA table_info(events)").all();
    const eventColNames = eventCols.map((c: any) => c.name);
    if (!eventColNames.includes("image_url")) {
      sqliteDb.exec("ALTER TABLE events ADD COLUMN image_url TEXT DEFAULT NULL");
    }

    const companyCheckCols = sqliteDb.prepare("PRAGMA table_info(company_profiles)").all();
    const companyCheckColNames = companyCheckCols.map((c: any) => c.name);
    if (!companyCheckColNames.includes("is_submitted")) {
      sqliteDb.exec("ALTER TABLE company_profiles ADD COLUMN is_submitted INTEGER DEFAULT 0");
    }
    const newGlobalCompCols = [
      { name: "entity_type", type: "TEXT" },
      { name: "registry_number", type: "TEXT" },
      { name: "tax_id", type: "TEXT" },
      { name: "state_of_formation", type: "TEXT" },
      { name: "licensing_authority", type: "TEXT" },
      { name: "risk_score", type: "INTEGER DEFAULT 0" },
      { name: "risk_flags", type: "TEXT" },
      { name: "domain_checked", type: "INTEGER DEFAULT 0" },
      { name: "verification_level", type: "TEXT DEFAULT 'STANDARD'" },        
      { name: "registration_date", type: "TEXT" }
    ];
    for (const col of newGlobalCompCols) {
      if (!companyCheckColNames.includes(col.name)) {
        sqliteDb.exec(`ALTER TABLE company_profiles ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    // Enterprise Interview Platform Schema Migrations
    const scheduleCols = sqliteDb.prepare("PRAGMA table_info(interview_schedules)").all();
    const scheduleColNames = scheduleCols.map((c: any) => c.name);
    if (!scheduleColNames.includes("status")) {
      sqliteDb.exec("ALTER TABLE interview_schedules ADD COLUMN status TEXT DEFAULT 'UPCOMING'");
    }
    if (!scheduleColNames.includes("duration")) {
      sqliteDb.exec("ALTER TABLE interview_schedules ADD COLUMN duration INTEGER DEFAULT 30");
    }
    if (!scheduleColNames.includes("interviewer_name")) {
      sqliteDb.exec("ALTER TABLE interview_schedules ADD COLUMN interviewer_name TEXT DEFAULT NULL");
    }
    if (!scheduleColNames.includes("instructions")) {
      sqliteDb.exec("ALTER TABLE interview_schedules ADD COLUMN instructions TEXT DEFAULT NULL");
    }
    if (!scheduleColNames.includes("scheduler_hr_name")) {
      sqliteDb.exec("ALTER TABLE interview_schedules ADD COLUMN scheduler_hr_name TEXT DEFAULT NULL");
    }

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_attendees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        name TEXT DEFAULT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        speaker TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        recording_url TEXT,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        event_type TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        warning_type TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        technical_knowledge INTEGER DEFAULT 0,
        communication INTEGER DEFAULT 0,
        confidence INTEGER DEFAULT 0,
        leadership INTEGER DEFAULT 0,
        problem_solving INTEGER DEFAULT 0,
        cultural_fit INTEGER DEFAULT 0,
        comments TEXT,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_ai_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        communication_score REAL DEFAULT 0,
        confidence_score REAL DEFAULT 0,
        technical_understanding_score REAL DEFAULT 0,
        problem_solving_score REAL DEFAULT 0,
        leadership_score REAL DEFAULT 0,
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

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS interview_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        report_data TEXT,
        pdf_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        college_id INTEGER NOT NULL,
        tpo_id INTEGER DEFAULT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        batch_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tpo_id INTEGER NOT NULL,
        college_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        category TEXT DEFAULT 'Aptitude',
        difficulty TEXT DEFAULT 'Medium',
        language TEXT DEFAULT 'English',
        department TEXT DEFAULT NULL,
        max_marks INTEGER DEFAULT 100,
        passing_marks INTEGER DEFAULT 40,
        negative_marking INTEGER DEFAULT 0,
        randomize_questions INTEGER DEFAULT 0,
        randomize_options INTEGER DEFAULT 0,
        calculator_allowed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'DRAFT',
        test_date DATE DEFAULT NULL,
        start_time TEXT DEFAULT NULL,
        end_time TEXT DEFAULT NULL,
        late_join_window INTEGER DEFAULT 10,
        duration_minutes INTEGER DEFAULT 60,
        webcam_monitoring INTEGER DEFAULT 0,
        camera_required INTEGER DEFAULT 0,
        microphone_required INTEGER DEFAULT 0,
        location_mandatory INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        batch_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL,
        options_json TEXT,
        correct_answers_json TEXT,
        marks INTEGER DEFAULT 1,
        negative_marks REAL DEFAULT 0.0,
        explanation TEXT,
        image_url TEXT,
        topic TEXT DEFAULT NULL,
        difficulty TEXT DEFAULT 'Medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tpo_id INTEGER NOT NULL,
        topic TEXT DEFAULT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL,
        difficulty TEXT DEFAULT 'Medium',
        options_json TEXT,
        correct_answers_json TEXT,
        explanation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        student_user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'STARTED',
        score REAL DEFAULT 0,
        percentage REAL DEFAULT 0,
        rank_val INTEGER DEFAULT NULL,
        is_passed INTEGER DEFAULT 0,
        started_at DATETIME NOT NULL,
        submitted_at DATETIME DEFAULT NULL,
        total_time_taken_seconds INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE,
        FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        student_answer_json TEXT,
        is_correct INTEGER DEFAULT 0,
        marks_obtained REAL DEFAULT 0,
        time_spent_seconds INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        violation_type TEXT NOT NULL,
        warning_count INTEGER DEFAULT 1,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_location (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        latitude REAL DEFAULT NULL,
        longitude REAL DEFAULT NULL,
        accuracy REAL DEFAULT NULL,
        ip_address TEXT DEFAULT NULL,
        browser TEXT DEFAULT NULL,
        device TEXT DEFAULT NULL,
        location_address TEXT DEFAULT NULL,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        student_user_id INTEGER NOT NULL,
        report_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessment_tests(id) ON DELETE CASCADE,
        FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS assessment_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS campus_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tpo_id INTEGER NOT NULL,
        college_id INTEGER NOT NULL,
        batch_name TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT DEFAULT 'GENERAL',
        priority TEXT DEFAULT 'NORMAL',
        attachment_type TEXT DEFAULT 'NONE',
        attachment_url TEXT,
        attachment_name TEXT,
        attachment_size TEXT,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN category TEXT DEFAULT 'GENERAL'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN priority TEXT DEFAULT 'NORMAL'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN attachment_type TEXT DEFAULT 'NONE'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN attachment_url TEXT"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN attachment_name TEXT"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE campus_notices ADD COLUMN attachment_size TEXT"); } catch (e) {}

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS study_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tpo_id INTEGER NOT NULL,
        college_id INTEGER NOT NULL,
        batch_name TEXT DEFAULT 'ALL',
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'General',
        attachment_type TEXT NOT NULL,
        attachment_url TEXT NOT NULL,
        file_name TEXT,
        file_size TEXT,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Apply High-Coverage Performance Indices for SQLite
    sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);");
    sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_student_profiles_onboarding ON student_profiles(onboarding_completed, onboarding_status);");
    sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);");
    sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_job_applications_student_job ON job_applications(student_id, job_id);");
    sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_performance_stats_xp ON student_performance_stats(xp_points);");

    // Ensure assessment_batches has college_id on SQLite
    try {
      const batchCols = sqliteDb.prepare("PRAGMA table_info(assessment_batches)").all();
      const batchColNames = batchCols.map((c: any) => c.name);
      if (batchColNames.length > 0 && !batchColNames.includes("college_id")) {
        sqliteDb.exec("ALTER TABLE assessment_batches ADD COLUMN college_id INTEGER NOT NULL DEFAULT 1");
      }
    } catch (e) {}

    // Ensure assessment_location has location_address on SQLite
    try {
      const locCols = sqliteDb.prepare("PRAGMA table_info(assessment_location)").all();
      const locColNames = locCols.map((c: any) => c.name);
      if (locColNames.length > 0 && !locColNames.includes("location_address")) {
        sqliteDb.exec("ALTER TABLE assessment_location ADD COLUMN location_address TEXT DEFAULT NULL");
      }
    } catch (e) {}

    // Migration for job_applications rejection columns
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_stage_id INTEGER NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejection_feedback TEXT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejected_at DATETIME NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE job_applications ADD COLUMN rejected_by_user_id INTEGER NULL"); } catch (e) {}

    // Migration for notifications idempotency_key
    try { sqliteDb.exec("ALTER TABLE notifications ADD COLUMN idempotency_key TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key)"); } catch (e) {}

    // Migrations for assessment workflow
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN company_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN stage_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN cutoff_score REAL DEFAULT 40"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN duration INTEGER DEFAULT 30"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN status TEXT DEFAULT 'PUBLISHED'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tests ADD COLUMN version INTEGER DEFAULT 1"); } catch (e) {}

    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN job_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN percentage REAL DEFAULT 0"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN passed INTEGER DEFAULT 0"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN cutoff_score REAL DEFAULT 0"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN total_marks REAL DEFAULT 100"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE test_submissions ADD COLUMN violations_count INTEGER DEFAULT 0"); } catch (e) {}

    try { sqliteDb.exec("ALTER TABLE assessment_tests ADD COLUMN company_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_tests ADD COLUMN job_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_tests ADD COLUMN stage_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_tests ADD COLUMN cutoff_score REAL DEFAULT 40"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_tests ADD COLUMN version INTEGER DEFAULT 1"); } catch (e) {}

    try { sqliteDb.exec("ALTER TABLE assessment_attempts ADD COLUMN job_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_attempts ADD COLUMN application_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_attempts ADD COLUMN cutoff_score REAL DEFAULT 40"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE assessment_attempts ADD COLUMN violations_count INTEGER DEFAULT 0"); } catch (e) {}

    // Clean up seeded demo batches to ensure "no static data"
    try {
      sqliteDb.exec("DELETE FROM assessment_batches WHERE batch_name IN ('CS-2024', 'IT-2024', 'ECE-2024')");
    } catch (e) {}

    // Ensure tpo_profiles has rich profile columns
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN alternate_contact TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN department TEXT DEFAULT 'Training & Placement Cell'"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN office_location TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN office_hours TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN bio TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN linkedin_url TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN profile_photo_url TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN secondary_email TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN experience_years TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN qualification TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN employee_id TEXT DEFAULT NULL"); } catch (e) {}
    try { sqliteDb.exec("ALTER TABLE tpo_profiles ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) {}
  } catch (e) { 
    console.error("SQLite migration error:", e);
  }

  console.log("✅ SQLite Database initialized");
}
