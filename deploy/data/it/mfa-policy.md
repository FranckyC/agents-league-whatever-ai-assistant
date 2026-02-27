# Multi-Factor Authentication (MFA) Policy

**Policy ID:** IT-POL-001  
**Effective Date:** January 1, 2025  
**Last Revised:** August 10, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy mandates the use of Multi-Factor Authentication (MFA) for all Contoso Ltd. employees to protect corporate systems, data, and user accounts from unauthorized access.

## 2. Scope

This policy applies to all employees, contractors, interns, and third-party vendors accessing Contoso systems, including:

- Corporate email (Microsoft 365)
- VPN and remote access
- Cloud platforms (Azure, AWS)
- Internal business applications (ERP, CRM, HR Portal)
- Source code repositories
- Administrative and privileged accounts

## 3. MFA Requirements

### 3.1 Mandatory Enrollment

All users must enroll in MFA within **5 business days** of account provisioning. Accounts that are not enrolled after 5 days will be restricted to on-premises access only until enrollment is completed.

### 3.2 Approved MFA Methods

| Priority | Method                          | Notes                                         |
| -------- | ------------------------------- | --------------------------------------------- |
| 1        | Microsoft Authenticator app     | Preferred — push notification or TOTP          |
| 2        | FIDO2 hardware security key     | Required for privileged accounts               |
| 3        | SMS one-time passcode           | Permitted only as a backup method              |
| 4        | Phone call verification         | Permitted only as a last-resort backup         |

- SMS-only authentication is **not permitted** as a primary MFA method due to SIM-swap risks.
- Privileged accounts (Global Admin, Security Admin, etc.) **must** use a FIDO2 key or Authenticator app with number matching.

### 3.3 When MFA Is Required

MFA is required for:

- Every sign-in from an unrecognized device or location
- All sign-ins to privileged / admin portals
- VPN connections
- Access from personal (BYOD) devices
- Password resets and account recovery

MFA may be satisfied by a compliant, managed device (Conditional Access policy) for routine sign-ins from the corporate network.

## 4. Exemptions

Temporary MFA exemptions may be granted by the IT Security Team for:

- Service accounts that cannot support interactive MFA (must use certificate-based authentication instead)
- Accessibility accommodations (alternative methods will be provided)

Exemption requests must be submitted via the **IT Service Desk** and are reviewed quarterly.

## 5. Lost or Compromised MFA Device

If an MFA device is lost, stolen, or compromised:

1. Report immediately to the **IT Service Desk** (ext. **5000** or **it-help@contoso.com**).
2. The IT Security Team will disable the compromised method within **1 hour** of the report.
3. A temporary access pass will be issued (valid for **8 hours**) to allow re-enrollment.
4. The user must enroll a new MFA method before the temporary pass expires.

## 6. Non-Compliance

- Accounts without MFA enrollment after the grace period will be **blocked from remote access**.
- Repeated refusal to comply may result in disciplinary action per HR-POL-010.
- Managers will be notified of non-compliant direct reports on a weekly basis.

## 7. Contact

For MFA support, contact the **IT Service Desk** at **it-help@contoso.com** or ext. **5000**.
