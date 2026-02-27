# VPN & Remote Access Policy

**Policy ID:** IT-POL-003  
**Effective Date:** January 1, 2025  
**Last Revised:** September 5, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy establishes the requirements for secure remote access to Contoso Ltd. corporate network and resources via Virtual Private Network (VPN) and other remote access technologies.

## 2. Scope

This policy applies to all employees, contractors, and authorized third parties who access Contoso's internal network from outside corporate premises.

## 3. Approved Remote Access Methods

| Method                  | Use Case                                              | Approval Required |
| ----------------------- | ----------------------------------------------------- | ----------------- |
| **GlobalProtect VPN**   | Full network access for employees                     | Automatic (MFA)   |
| **Azure AD App Proxy**  | Access to specific web apps without VPN               | Automatic (MFA)   |
| **Privileged Access Workstation (PAW)** | Admin access to servers and infrastructure | IT Security Team  |
| **Third-party VPN**     | Vendor access to isolated network segments             | IT Security Team  |

## 4. VPN Configuration Requirements

- All VPN connections must use **TLS 1.3** or **IPsec IKEv2** encryption.
- Split tunneling is **disabled** by default. Exceptions require IT Security approval.
- VPN sessions are limited to **12 hours**. Users must re-authenticate after session expiration.
- Idle sessions are disconnected after **30 minutes** of inactivity.

## 5. Authentication

- VPN access requires **MFA** (see IT-POL-001).
- Certificate-based device authentication is required in addition to user MFA for accessing sensitive network segments (e.g., finance, HR systems).
- Service accounts used for automated VPN connections must use **certificate-based authentication** and are reviewed quarterly.

## 6. Device Compliance

Devices connecting via VPN must meet the following minimum requirements:

| Requirement              | Standard                                        |
| ------------------------ | ----------------------------------------------- |
| Operating System         | Windows 11 23H2+, macOS 14+, or approved Linux  |
| Antivirus                | Microsoft Defender for Endpoint (active & updated) |
| Disk Encryption          | BitLocker (Windows) or FileVault (macOS) enabled |
| Patch Level              | All critical patches applied within 14 days      |
| MDM Enrollment           | Enrolled in Microsoft Intune                     |

Non-compliant devices will be **blocked from VPN access** until remediated.

## 7. Prohibited Activities Over VPN

The following are prohibited when connected to the corporate VPN:

- Torrenting or peer-to-peer file sharing
- Accessing content that violates the Acceptable Use Policy (IT-POL-010)
- Running network scanning or penetration testing tools without written authorization
- Bridging the VPN connection to another network (e.g., home network sharing)
- Connecting from public Wi-Fi without using a company-managed device

## 8. Third-Party & Vendor Access

- Third-party vendors must use a **dedicated vendor VPN profile** with access restricted to approved network segments only.
- Vendor VPN accounts expire after **90 days** and must be renewed by the sponsoring Contoso employee.
- All vendor sessions are logged and subject to audit.

## 9. Logging & Monitoring

All VPN connections are logged, including:

- User identity, source IP, connection time, and duration
- Data volume transferred
- Resources accessed

Logs are retained for **12 months** and are subject to review by the IT Security Team.

## 10. Contact

For VPN access issues, contact the **IT Service Desk** at **it-help@contoso.com** or ext. **5000**.
