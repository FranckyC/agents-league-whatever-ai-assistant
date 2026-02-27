# Data Classification & Handling Policy

**Policy ID:** IT-POL-006  
**Effective Date:** January 1, 2025  
**Last Revised:** November 5, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy establishes the data classification framework and handling requirements for all information created, processed, stored, or transmitted by Contoso Ltd.

## 2. Scope

This policy applies to all data in any format (electronic, paper, verbal) across all Contoso systems, cloud services, and physical locations.

## 3. Classification Levels

All Contoso data must be classified into one of four levels:

| Level              | Label Color | Description                                                        |
| ------------------ | ----------- | ------------------------------------------------------------------ |
| **Public**         | Green       | Information approved for public disclosure (e.g., marketing materials, press releases). |
| **Internal**       | Yellow      | General business information not intended for public release (e.g., org charts, internal newsletters). |
| **Confidential**   | Orange      | Sensitive business data that could cause harm if disclosed (e.g., financials, strategy docs, customer lists). |
| **Restricted**     | Red         | Highly sensitive data with legal or regulatory implications (e.g., PII, PHI, trade secrets, credentials). |

## 4. Classification Responsibilities

- **Data Owners** (typically department heads) are responsible for classifying data under their control.
- **Data Custodians** (IT operations) are responsible for implementing technical controls appropriate to the classification level.
- **All Employees** are responsible for handling data according to its classification label.

## 5. Handling Requirements

### 5.1 Storage

| Classification  | Approved Storage                                     |
| --------------- | ---------------------------------------------------- |
| Public          | Any Contoso-approved platform                        |
| Internal        | SharePoint, OneDrive for Business, company file servers |
| Confidential    | SharePoint (with restricted permissions), encrypted file shares |
| Restricted      | Azure Information Protection–encrypted locations, CyberArk vault (for credentials) |

- **Restricted** data must **never** be stored on personal devices, USB drives, or unapproved cloud services.

### 5.2 Transmission

| Classification  | Email                          | File Sharing                   |
| --------------- | ------------------------------ | ------------------------------ |
| Public          | No restrictions                | No restrictions                |
| Internal        | Standard corporate email       | SharePoint / OneDrive links    |
| Confidential    | Encrypted email (auto-applied) | SharePoint with restricted sharing |
| Restricted      | Azure Information Protection (Do Not Forward) | Approved secure transfer only |

### 5.3 Printing

- **Confidential** and **Restricted** documents must be printed only on secure print-release printers.
- Printed **Restricted** documents must be retrieved immediately and stored in locked cabinets.
- Shredding is required for disposal of all printed **Confidential** and **Restricted** materials.

## 6. Labeling

- All electronic documents must carry a classification label applied via **Microsoft Purview Information Protection**.
- Labels are applied automatically for known data patterns (e.g., credit card numbers, SINs) and manually by users for other content.
- Emails containing **Confidential** or **Restricted** content are automatically labeled and encrypted.

## 7. Data Retention & Disposal

| Classification  | Minimum Retention | Disposal Method                          |
| --------------- | ----------------- | ---------------------------------------- |
| Public          | No minimum        | Standard deletion                        |
| Internal        | 3 years           | Standard deletion                        |
| Confidential    | 7 years           | Secure deletion (crypto-shredding for cloud) |
| Restricted      | 7 years           | Certified secure destruction, audit trail |

## 8. Incident Reporting

Any suspected data mishandling (e.g., sending Restricted data to the wrong recipient, finding Confidential data in a public location) must be reported to **security@contoso.com** within **4 hours** of discovery.

## 9. Training

All employees must complete **Data Classification & Handling** training within 30 days of hire and annually thereafter. Training is tracked in the Learning Management System.

## 10. Contact

For data classification questions, contact the **IT Security Team** at **security@contoso.com** or ext. **5010**.
