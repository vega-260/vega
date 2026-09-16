export interface HrPermissionItem {
  key: string;
  label: string;
  desc: string;
}

export const ALL_HR_PERMISSIONS: HrPermissionItem[] = [
  { key: "Dashboard View", label: "Dashboard View", desc: "Access to view the company overview dashboard" },
  { key: "Jobs View", label: "Jobs View", desc: "View posted job opportunities" },
  { key: "Create Jobs", label: "Create Jobs", desc: "Post new jobs to the platform" },
  { key: "Edit Jobs", label: "Edit Jobs", desc: "Modify job descriptions and details" },
  { key: "End Jobs", label: "End Jobs", desc: "Archive or close active job postings" },
  { key: "Applicants View", label: "Applicants View", desc: "View the list of job applicants" },
  { key: "Pipeline View", label: "Pipeline View", desc: "Access the recruitment pipeline kanban" },
  { key: "Pipeline Manage", label: "Pipeline Manage", desc: "Move candidates between recruitment stages" },
  { key: "Candidate Select/Reject", label: "Candidate Select/Reject", desc: "Make selection or rejection decisions" },
  { key: "Candidate Notify", label: "Candidate Notify", desc: "Notify candidates about final application decisions" },
  { key: "Interview View", label: "Interview View", desc: "View scheduled interviews and feedback" },
  { key: "Schedule Interviews", label: "Schedule Interviews", desc: "Schedule or reschedule candidate interview slots" },
  { key: "Assessments View", label: "Assessments View", desc: "View test submissions and scoring details" },
  { key: "Create/Edit Tests", label: "Create/Edit Tests", desc: "Manage custom platform assessments and questionnaires" },
  { key: "Recommendations View", label: "Recommendations View", desc: "View AI recommendations and matches" },
  { key: "Drops View", label: "Drops View", desc: "Access drop management & view drops history" },
  { key: "Drops Create", label: "Drops Create", desc: "Post new company drops and updates" },
  { key: "Drops Edit", label: "Drops Edit", desc: "Modify published company drops" },
  { key: "Drops Delete", label: "Drops Delete", desc: "Remove published company drops" },
  { key: "Analytics View", label: "Analytics View", desc: "View recruitment statistics and reports" },
  { key: "Company Profile View", label: "Company Profile View", desc: "View and edit corporate details" },
  { key: "Audit Trail View Own", label: "Audit Trail View Own", desc: "View own activities/logs in the audit trail" }
];

export const DEFAULT_SUB_HR_PERMISSIONS: string[] = [
  'Dashboard View',
  'Jobs View',
  'Applicants View',
  'Pipeline View',
  'Pipeline Manage'
];
