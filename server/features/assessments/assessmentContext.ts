import { assessmentRepository } from "./assessmentRepository.ts";

export async function getTPOContext(userId: number) {
  const tpo = await assessmentRepository.findTpoByUserId(userId);
  if (!tpo) return null;
  const mapped = await assessmentRepository.findTpoCollegeIds(Number(tpo.id));
  const collegeId = mapped[0] ?? await assessmentRepository.findFirstBatchCollegeId(Number(tpo.id));
  return { tpoId: Number(tpo.id), collegeId };
}

export async function getStudentContext(userId: number) {
  const profile = await assessmentRepository.findStudentContext(userId);
  if (!profile) return null;
  return { id: Number(profile.id), collegeId: profile.college_id, batch: profile.batch, batchStatus: profile.batch_status, batch_status: profile.batch_status };
}

export async function getCompanyContext(userId: number) {
  const companyId = await assessmentRepository.findCompanyIdForUser(userId);
  return companyId ? { companyId } : null;
}

export async function reverseGeocode(latitude: number | null | undefined, longitude: number | null | undefined): Promise<string> {
  if (latitude == null || longitude == null) return "Unknown location";
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, { headers: { "User-Agent": "VEGA-Assessment/1.0" } });
    if (!response.ok) return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const data: any = await response.json();
    return data?.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch { return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`; }
}

export async function getIpLocation(ip: string) {
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return null;
  try {
    const cleanIp = ip.replace(/^::ffff:/, "");
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`);
    if (!response.ok) return null;
    const data: any = await response.json();
    if (data?.error) return null;
    return { latitude: Number(data.latitude), longitude: Number(data.longitude), address: [data.city, data.region, data.country_name].filter(Boolean).join(", ") };
  } catch { return null; }
}

export function parseUserAgent(userAgentStr: string) {
  const ua = userAgentStr || "";
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Microsoft Edge"; else if (/Chrome\//.test(ua)) browser = "Google Chrome"; else if (/Firefox\//.test(ua)) browser = "Mozilla Firefox"; else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  let os = "Unknown";
  if (/Windows NT/.test(ua)) os = "Windows"; else if (/Android/.test(ua)) os = "Android"; else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS"; else if (/Mac OS X/.test(ua)) os = "macOS"; else if (/Linux/.test(ua)) os = "Linux";
  let device = "Desktop";
  if (/Mobi|Android|iPhone|iPad|iPod/.test(ua)) device = /iPad|Tablet/.test(ua) ? "Tablet" : "Mobile";
  return { browser, os, device };
}

export function getTestStatus(test: any): string {
  if (test.status === "DRAFT") return "DRAFT";
  if (!test.test_date || !test.start_time) return test.status || "UPCOMING";
  try {
    const now = new Date();
    let dateStr = "";
    if (test.test_date instanceof Date) {
      const year = test.test_date.getFullYear();
      const month = String(test.test_date.getMonth() + 1).padStart(2, "0");
      const day = String(test.test_date.getDate()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(test.test_date).split("T")[0];
    }
    const startDt = new Date(`${dateStr}T${test.start_time}:00`);
    const endDt = test.end_time ? new Date(`${dateStr}T${test.end_time}:00`) : new Date(startDt.getTime() + parseInt(test.duration_minutes || 60) * 60000);
    if (now >= startDt && now <= endDt) return "ONGOING";
    if (now > endDt) return "COMPLETED";
    return "UPCOMING";
  } catch {
    return test.status || "UPCOMING";
  }
}
