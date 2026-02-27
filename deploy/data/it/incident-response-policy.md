# Security Incident Response Policy

**Policy ID:** IT-POL-007  
**Effective Date:** January 1, 2025  
**Last Revised:** October 15, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy defines the procedures for detecting, reporting, responding to, and recovering from information security incidents at Contoso Ltd.

## 2. Scope

This policy covers all security events and incidents affecting Contoso's information systems, data, employees, and third-party partners.

## 3. Definitions

| Term                | Definition                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| **Security Event**  | Any observable occurrence relevant to information security (e.g., failed login, firewall alert). |
| **Security Incident** | A confirmed or strongly suspected breach of security policy that impacts confidentiality, integrity, or availability of data or systems. |
| **Data Breach**     | A security incident that results in unauthorized access to or disclosure of Restricted or Confidential data. |

## 4. Incident Severity Levels

| Severity    | Description                                                         | Response Time  |
| ----------- | ------------------------------------------------------------------- | -------------- |
| **Critical** | Active data breach, ransomware, system-wide outage                  | **15 minutes** |
| **High**     | Confirmed unauthorized access, compromised privileged account       | **1 hour**     |
| **Medium**   | Suspicious activity, phishing with credential entry, malware detected | **4 hours**    |
| **Low**      | Anomalous but unconfirmed activity, policy violations               | **24 hours**   |

## 5. Reporting an Incident

Any employee who suspects or witnesses a security incident must report it immediately via:

| Channel                   | Contact                              |
| ------------------------- | ------------------------------------ |
| IT Service Desk           | it-help@contoso.com / ext. 5000      |
| Security Operations Center | security@contoso.com                |
| Emergency Hotline (24/7)  | 1-800-555-SEC1 (7321)                |
| Anonymous Reporting       | security-anon.contoso.com            |

**Do not** attempt to investigate or remediate the incident yourself. Preserve evidence by not shutting down, deleting files, or modifying affected systems.

## 6. Incident Response Process

### 6.1 Phase 1: Detection & Triage (0–30 minutes)

- The Security Operations Center (SOC) receives and logs the report.
- Initial severity assessment is performed.
- An **Incident Commander** is assigned for Medium and above incidents.

### 6.2 Phase 2: Containment (30 minutes – 4 hours)

- Affected systems or accounts are isolated.
- Compromised credentials are reset.
- Network segments may be quarantined.
- Forensic imaging begins for Critical/High incidents.

### 6.3 Phase 3: Eradication & Recovery (4 hours – 72 hours)

- Root cause is identified and eliminated.
- Systems are restored from clean backups.
- Additional monitoring is deployed on affected assets.
- Affected users are notified and guided on protective steps (e.g., password reset, credit monitoring).

### 6.4 Phase 4: Post-Incident Review (Within 10 business days)

- A **Post-Incident Report (PIR)** is prepared for Medium and above incidents.
- A blameless retrospective meeting is held with all involved parties.
- Remediation action items are assigned with deadlines and owners.
- Lessons learned are shared with the broader organization (anonymized if necessary).

## 7. Communication

- **Internal:** The Incident Commander coordinates all internal communications. Employees must not discuss incidents on social media or with external parties.
- **External:** The Legal and Communications teams handle all external disclosures, including regulatory notifications (e.g., Privacy Commissioner) within the legally required timeframes.
- **Regulatory:** Data breaches affecting personal information must be reported to the Office of the Privacy Commissioner of Canada within **72 hours**.

## 8. Evidence Preservation

- All incident-related evidence (logs, emails, screenshots, forensic images) must be preserved for at least **7 years**.
- Chain of custody must be documented for any evidence that may be used in legal proceedings.

## 9. Annual Testing

- The Incident Response Plan is tested at least **twice per year** through tabletop exercises and simulated incidents.
- Results are documented and used to improve the plan.

## 10. Contact

For security incidents, contact the **Security Operations Center** at **security@contoso.com** or the **24/7 Emergency Hotline** at **1-800-555-7321**.
