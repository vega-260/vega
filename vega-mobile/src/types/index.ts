export interface User {
  id: number;
  email: string;
  role: "STUDENT" | "COMPANY" | "ADMIN" | "TPO";
  fullName?: string;
  avatarUrl?: string;
  collegeName?: string;
  branch?: string;
  graduationYear?: number;
  companyName?: string;
  token?: string;
  refreshToken?: string;
}

export interface TalentScoreBreakdown {
  skills: number;
  interview: number;
  coding: number;
  psychometric: number;
  academic: number;
}

export interface UpcomingInterview {
  id: number;
  companyName: string;
  role: string;
  scheduledAt: string;
  type: "AI_MOCK" | "TECHNICAL" | "HR" | "SCREENING";
  joinUrl?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string;
}

export interface StudentDashboardData {
  talentScore: number;
  talentScoreBreakdown: TalentScoreBreakdown;
  xpBalance: number;
  streak: number;
  rank: number;
  recommendedJobsCount: number;
  appliedCount: number;
  inReviewCount: number;
  upcomingInterviews: UpcomingInterview[];
}

export interface CodeProfile {
  platform: "LeetCode" | "CodeChef" | "Codeforces" | "GitHub" | "HackerRank";
  username: string;
  globalScore: number;
  solvedCount: number;
  ranking?: number;
  updatedAt: string;
}

export interface Job {
  id: number;
  title: string;
  companyName: string;
  companyLogo?: string;
  location: string;
  type: "Full-time" | "Internship" | "Contract";
  description: string;
  salary: string;
  skillsRequired: string[];
  applied?: boolean;
  applicationId?: number;
  deadline?: string;
  openings?: number;
  matchScore?: number;
}

export type ApplicationStage = "APPLIED" | "TEST" | "TECHNICAL_INTERVIEW" | "HR_INTERVIEW" | "SELECTED" | "REJECTED";

export interface ApplicationTrackerItem {
  id: number;
  jobId: number;
  jobTitle: string;
  companyName: string;
  appliedAt: string;
  currentStage: ApplicationStage;
  stageHistory: Array<{
    stage: ApplicationStage;
    completedAt?: string;
    comments?: string;
    status: "COMPLETED" | "ACTIVE" | "PENDING";
  }>;
  nextStep?: string;
  nextStepDate?: string;
}

export interface AssessmentTest {
  id: number;
  title: string;
  category: "CODING" | "APTITUDE" | "TECHNICAL_CORE" | "COMMUNICATION" | "PSYCHOMETRIC";
  durationMinutes: number;
  questionCount: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  xpReward: number;
  isCompleted?: boolean;
  score?: number;
}

export interface Question {
  id: number;
  prompt: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface Post {
  id: number;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title: string;
  content: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isUnlocked: boolean;
  xpUnlockCost?: number;
  createdAt: string;
}

export interface RecruiterCandidate {
  id: number;
  userId: number;
  name: string;
  email: string;
  college: string;
  branch: string;
  talentScore: number;
  codingScore: number;
  interviewScore: number;
  skills: string[];
  applicationStage: ApplicationStage;
  jobId: number;
  jobTitle: string;
  appliedDate: string;
  resumeUrl?: string;
}

export interface RecruiterAnalytics {
  activeJobsCount: number;
  totalApplicants: number;
  interviewSchedules: number;
  hiredCount: number;
  funnelStages: {
    applied: number;
    test: number;
    technical: number;
    hr: number;
    hired: number;
  };
}

export interface TpoAnalytics {
  totalStudents: number;
  placedStudents: number;
  placementRate: number;
  averagePackageLPA: number;
  highestPackageLPA: number;
  activeDrives: number;
  topRecruiters: Array<{ name: string; count: number }>;
}

