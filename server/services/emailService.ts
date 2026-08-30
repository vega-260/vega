import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends email via Resend HTTP API (Port 443 HTTPS - never blocked by cloud hosts)
 */
async function sendViaResendApi(apiKey: string, to: string, subject: string, html: string, senderEmail: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: senderEmail && !senderEmail.includes("gmail.com") ? (senderEmail.includes("<") ? senderEmail : `VEGA <${senderEmail}>`) : "VEGA <onboarding@resend.dev>",
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errText}`);
  }

  return response.json();
}

function getTransporter() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const rawPort = process.env.SMTP_PORT?.trim();
  const port = rawPort ? parseInt(rawPort, 10) : 465;
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port: port || 587,
    secure: false, // Use false for port 587
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    },
    family: 4, // Force IPv4
    connectionTimeout: 30000, // Increase timeout to 30s
    greetingTimeout: 30000,
    socketTimeout: 30000
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    // 1. Check HTTP API providers first
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const senderEmail = process.env.SENDER_EMAIL?.trim() || process.env.SMTP_USER?.trim() || "notifications@vega.ai";

    if (resendApiKey) {
      await sendViaResendApi(resendApiKey, to, subject, html, senderEmail);
      console.log("Email sent successfully via Resend HTTP API to %s", to);
      return true;
    }

    // 2. SMTP Transport
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');

    if (!user || !pass) {
      console.warn("⚠️ No Email API key (RESEND_API_KEY) or SMTP credentials found. Email not sent.");
      console.log(`--- EMAIL PREVIEW ---
To: ${to}
Subject: ${subject}
---------------------`);
      return true;
    }

    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: `"VEGA" <${user}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully to %s, messageId: %s", to, info?.messageId || 'ok');
    return true;
  } catch (error: any) {
    console.error("Error sending email to " + to + ":", error?.message || error);
    return false;
  }
}

export async function sendOTP(email: string, otp: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">Verify Your VEGA Account</h2>
      <p>Hello,</p>
      <p>Your verification code for VEGA is:</p>
      <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; border-radius: 8px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, "VEGA Verification Code", html);
}

export async function sendPasswordReset(email: string, resetLink: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">Reset Your Password</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your VEGA account. Click the button below to proceed:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, "Reset Your VEGA Password", html);
}

export async function sendTPOCredentials(email: string, name: string, tempPass: string, loginUrl: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">Welcome to VEGA TPO Ecosystem</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your Training & Placement Officer account has been created by the administrator. You can now access the Placement Intelligence Dashboard.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 4px;">${tempPass}</code></p>
      </div>

      <p style="color: #dc2626; font-weight: bold;">Note: You will be required to change your password upon your first login for security purposes.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
      </div>

      <p>If you have any questions, please contact the system administrator.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, "Your VEGA TPO Account Credentials", html);
}

export async function sendStudentCredentials(email: string, name: string, tempPass: string, collegeName: string, batchName: string, loginUrl: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">Welcome to VEGA!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your student account has been registered by your college Placement Administrator at <strong>${collegeName}</strong> for the batch <strong>${batchName}</strong>.</p>
      <p>You can now log in, build your professional resume, take skill assessments, and participate in placement drives!</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="margin: 5px 0;"><strong>College:</strong> ${collegeName}</p>
        <p style="margin: 5px 0;"><strong>Batch:</strong> ${batchName}</p>
        <p style="margin: 5px 0;"><strong>Username / Email:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 4px;">${tempPass}</code></p>
      </div>

      <p style="color: #dc2626; font-weight: bold;">Note: It is highly recommended to change/reset your password upon login under your Profile preferences.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log in and Get Placed</a>
      </div>

      <p>If you have any questions, please contact your TPO.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, `Your VEGA Student Credentials - ${collegeName}`, html);
}

export async function sendJobEndingSoonEmail(email: string, hrName: string, jobTitle: string, location: string, endDate: string, link: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">Job Post Ending Soon</h2>
      <p>Hello <strong>${hrName}</strong>,</p>
      <p>This is a notification from VEGA that your job posting is approaching its closing date.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 5px 0;"><strong>Job Title:</strong> ${jobTitle}</p>
        <p style="margin: 5px 0;"><strong>Location:</strong> ${location || "Remote / Not Specified"}</p>
        <p style="margin: 5px 0;"><strong>End Date:</strong> ${endDate}</p>
      </div>

      <p>Please note that once the job post ends, the related recruitment pipeline will also end automatically, and no further candidate stage movements will be permitted.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Jobs & Pipeline</a>
      </div>

      <p>If you have any questions or would like to extend the deadline, please log into your dashboard to update the position details.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, `VEGA Alert: Job Post Ending Soon - ${jobTitle}`, html);
}

export async function sendInterviewInvitationToAttendee(
  email: string,
  attendeeName: string,
  candidateName: string,
  jobTitle: string,
  dateTime: string,
  type: string,
  locationOrLink: string,
  schedulerHrName: string,
  notes: string,
  role: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">New Interview Scheduled</h2>
      <p>Hello <strong>${attendeeName || 'Interviewer'}</strong>,</p>
      <p>You have been added as an attendee with the role of <strong>${role || 'Panelist'}</strong> for an upcoming candidate interview on VEGA.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidateName}</p>
        <p style="margin: 5px 0;"><strong>Job Title/Role:</strong> ${jobTitle}</p>
        <p style="margin: 5px 0;"><strong>Interview Type:</strong> ${type}</p>
        <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${dateTime}</p>
        <p style="margin: 5px 0;"><strong>Location / Meeting Link:</strong> ${locationOrLink}</p>
        <p style="margin: 5px 0;"><strong>Scheduled By:</strong> ${schedulerHrName || 'HR Team'}</p>
      </div>

      ${notes ? `<p><strong>Notes / Instructions:</strong> ${notes}</p>` : ''}

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
    </div>
  `;
  return sendEmail(email, `VEGA Invitation: ${jobTitle} Interview with ${candidateName}`, html);
}

export async function sendTPOPasswordResetOTP(email: string, name: string, otp: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">VEGA TPO Security</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Training & Placement Officer Ecosystem</p>
      </div>

      <p style="font-size: 15px; color: #1e293b; line-height: 1.5;">Hello <strong>${name || 'Placement Officer'}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        We received a request to reset the password for your VEGA TPO account (<strong>${email}</strong>). Use the verification code below to authorize this password reset:
      </p>

      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 11px; font-weight: bold; color: #1d4ed8; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 8px;">Your Security Verification Code</span>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #1e40af;">
          ${otp}
        </div>
        <span style="font-size: 12px; color: #3b82f6; display: block; margin-top: 8px; font-weight: 500;">Valid for 10 minutes &bull; Single-use only</span>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #991b1b; font-size: 12px; line-height: 1.5; margin: 0;">
          <strong>Security Notice:</strong> Never share this OTP with anyone. VEGA administrative staff will never ask for your verification code or password.
        </p>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        If you did not request a password reset, your account credentials may still be safe, but we recommend checking your active sessions or contacting the platform administrator.
      </p>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} VEGA Talent Platform &bull; Secure Institutional Access
      </p>
    </div>
  `;
  return sendEmail(email, "VEGA TPO: Password Reset Verification Code", html);
}

export async function sendTPOPasswordChangedAlert(email: string, name: string, ipAddress?: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #059669; margin: 0; font-size: 22px; font-weight: 800;">Password Updated Successfully</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">VEGA TPO Security Alert</p>
      </div>

      <p style="font-size: 15px; color: #1e293b; line-height: 1.5;">Hello <strong>${name || 'Placement Officer'}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        This email confirms that the password for your VEGA TPO account (<strong>${email}</strong>) was successfully updated on <strong>${new Date().toUTCString()}</strong>.
      </p>

      ${ipAddress ? `<p style="font-size: 12px; color: #64748b;">Request origin IP: <code>${ipAddress}</code></p>` : ''}

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="color: #334155; font-size: 13px; margin: 0; font-weight: 600;">Didn't make this change?</p>
        <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">
          If you did not make this change, your account may be compromised. Please contact your Super Administrator immediately.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} VEGA Talent Platform &bull; Security Team
      </p>
    </div>
  `;
  return sendEmail(email, "Security Alert: VEGA TPO Password Changed", html);
}
