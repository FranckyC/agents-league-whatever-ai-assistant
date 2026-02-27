# Email & Communication Security Policy

**Policy ID:** IT-POL-009  
**Effective Date:** January 1, 2025  
**Last Revised:** August 30, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy defines the security requirements and acceptable practices for email and corporate communication tools at Contoso Ltd.

## 2. Scope

This policy applies to all corporate communication channels, including:

- Microsoft Outlook / Exchange Online email
- Microsoft Teams (chat, channels, and meetings)
- SharePoint and OneDrive file sharing
- Any third-party communication tools approved for business use

## 3. Email Security Controls

### 3.1 Anti-Phishing Protection

Contoso employs the following anti-phishing measures:

| Control                        | Description                                           |
| ------------------------------ | ----------------------------------------------------- |
| Microsoft Defender for Office 365 | Advanced threat protection, safe links, safe attachments |
| DMARC / DKIM / SPF            | Email authentication to prevent spoofing               |
| External Email Banner          | All emails from outside Contoso display a yellow warning banner |
| AI-Powered Detection           | Machine learning models flag suspicious patterns       |
| Impersonation Protection       | Alerts on emails impersonating executives or partners  |

### 3.2 Reporting Suspicious Emails

Employees must report suspicious emails using the **"Report Phishing"** button in Outlook. This sends the email to the Security Operations Center for analysis. **Do not** forward suspicious emails to colleagues.

Response times:

| Priority         | Response                                            |
| ---------------- | --------------------------------------------------- |
| Confirmed phishing | Email removed from all mailboxes within **30 minutes** |
| Suspicious       | Analysis completed within **4 hours**                |

## 4. Email Usage Guidelines

### 4.1 Permitted Use

Corporate email may be used for:

- Business communications with internal and external parties
- Sending and receiving business documents
- Limited personal use that does not interfere with work duties

### 4.2 Prohibited Use

Corporate email must **not** be used for:

- Sending Restricted data without Azure Information Protection encryption
- Mass unsolicited emails (internal or external)
- Forwarding corporate emails to personal email accounts
- Subscribing to personal mailing lists or newsletters
- Chain letters, jokes, or political messaging to distribution lists
- Any communication that violates the Code of Conduct (HR-POL-010)

## 5. Email Retention

| Category                  | Retention Period |
| ------------------------- | ---------------- |
| General business email    | 3 years          |
| Legal / compliance holds  | Until released by Legal |
| Financial records         | 7 years          |
| HR / employee matters     | 7 years          |

- Employees should not manually delete emails that may be subject to legal holds.
- Deleted items are recoverable for **30 days** before permanent deletion.
- The IT team manages retention policies centrally via Microsoft Purview.

## 6. Microsoft Teams Security

- External guest access is limited to approved domains configured by IT.
- Teams channels containing **Confidential** or **Restricted** data must use **Sensitivity Labels**.
- Screen sharing in external meetings must be limited to specific windows (not full desktop).
- Meeting recordings are stored in OneDrive/SharePoint and subject to the same data classification policies.

## 7. Encryption

- All emails to external recipients are encrypted in transit via **TLS 1.3** (opportunistic).
- Emails classified as **Confidential** are automatically encrypted via Azure Information Protection.
- Emails classified as **Restricted** automatically apply the **"Do Not Forward"** restriction.

## 8. Auto-Forwarding

- Auto-forwarding corporate email to external addresses is **blocked** for all users.
- Internal auto-forwarding (e.g., to a shared mailbox) requires manager approval and IT configuration.

## 9. Monitoring & Auditing

Contoso reserves the right to monitor corporate email and communications for:

- Security threat detection
- Policy compliance
- Legal and regulatory requirements

Monitoring is conducted in accordance with applicable privacy laws. Employees have no expectation of privacy for communications sent via corporate systems.

## 10. Contact

For email security concerns, contact the **IT Security Team** at **security@contoso.com** or the **IT Service Desk** at ext. **5000**.
