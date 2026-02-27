# Password & Credential Management Policy

**Policy ID:** IT-POL-004  
**Effective Date:** January 1, 2025  
**Last Revised:** June 15, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy defines the requirements for creating, managing, and protecting passwords and credentials across all Contoso Ltd. systems.

## 2. Scope

This policy applies to all user accounts, service accounts, and system accounts on Contoso-managed systems, applications, and cloud services.

## 3. Password Requirements

### 3.1 User Accounts

| Requirement             | Standard                                |
| ----------------------- | --------------------------------------- |
| Minimum length          | **14 characters**                       |
| Complexity              | At least 3 of 4: uppercase, lowercase, numbers, special characters |
| Maximum age             | **365 days** (annual rotation)          |
| History                 | Cannot reuse the last **12 passwords**  |
| Lockout threshold       | **10 failed attempts** → 30-minute lockout |

### 3.2 Privileged / Admin Accounts

| Requirement             | Standard                                |
| ----------------------- | --------------------------------------- |
| Minimum length          | **20 characters**                       |
| Maximum age             | **90 days**                             |
| Storage                 | Must be stored in the corporate password vault (CyberArk) |
| MFA                     | **Always required** (FIDO2 key preferred) |

### 3.3 Service Accounts

- Service account passwords must be at least **30 characters** and randomly generated.
- Service accounts must use **Managed Service Accounts (gMSA)** or certificate-based authentication where supported.
- Manual service account passwords must be rotated every **90 days**.

## 4. Password Best Practices

Employees are encouraged to:

- Use **passphrases** (e.g., "Correct-Horse-Battery-Staple-42!") rather than complex short passwords.
- Use the company-approved **password manager** (1Password for Business) for all non-SSO credentials.
- Never reuse a corporate password on personal or external services.
- Never share passwords, even with IT staff (IT will never ask for your password).

## 5. Prohibited Practices

The following are strictly prohibited:

- Writing passwords on sticky notes, whiteboards, or shared documents
- Storing passwords in plain text (spreadsheets, text files, emails, chat)
- Sharing credentials with colleagues, even for "temporary" access
- Using corporate email addresses to register for personal services
- Embedding credentials in source code, scripts, or configuration files

## 6. Single Sign-On (SSO)

- All corporate applications must use **Azure AD SSO** where technically feasible.
- Applications that do not support SSO must be registered with IT and credentials stored in the corporate password vault.
- Shadow IT applications discovered during audits will be evaluated for SSO integration or blocked.

## 7. Password Reset Process

- Self-service password reset (SSPR) is available at **https://passwordreset.contoso.com**.
- SSPR requires MFA verification.
- If MFA is unavailable, the employee must visit the IT Service Desk **in person** with a government-issued photo ID.
- Passwords may also be reset by calling the IT Service Desk after identity verification (employee ID + date of birth + manager confirmation).

## 8. Breach Response

If a password is suspected to be compromised:

1. Change the password **immediately** via SSPR or the IT Service Desk.
2. Report the incident to **security@contoso.com**.
3. The IT Security Team will review access logs and initiate an investigation if warranted.
4. Affected accounts may be temporarily suspended during the investigation.

## 9. Contact

For credential issues, contact the **IT Service Desk** at **it-help@contoso.com** or ext. **5000**.
