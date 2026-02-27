# Bring Your Own Device (BYOD) Policy

**Policy ID:** IT-POL-005  
**Effective Date:** March 1, 2025  
**Last Revised:** October 1, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy defines the conditions under which employees may use personal devices to access Contoso Ltd. corporate data and systems.

## 2. Scope

This policy applies to all personal devices (smartphones, tablets, laptops) used to access corporate email, files, applications, or network resources.

## 3. Eligibility

- All full-time employees may enroll personal devices under the BYOD program.
- Contractors and interns may enroll personal devices only with written approval from their Contoso sponsor and the IT Security Team.
- A maximum of **3 personal devices** per employee may be enrolled.

## 4. Device Requirements

Personal devices must meet the following minimum requirements before enrollment:

| Requirement            | Standard                                          |
| ---------------------- | ------------------------------------------------- |
| Operating System       | iOS 17+, Android 14+, Windows 11 23H2+, macOS 14+ |
| Screen Lock            | PIN (6+ digits), biometric, or password enabled    |
| Encryption             | Full-device encryption enabled                     |
| Jailbreak / Root       | Devices must **not** be jailbroken or rooted       |
| Antivirus (Windows/Mac)| Microsoft Defender for Endpoint or approved equivalent |

## 5. Enrollment Process

1. Submit a **BYOD Enrollment Request** via the IT Self-Service Portal.
2. Install the **Microsoft Intune Company Portal** app on the device.
3. Follow the guided enrollment steps to register the device.
4. The IT system will verify compliance. Non-compliant devices will be prompted to remediate before access is granted.

Enrollment typically takes **15–30 minutes**.

## 6. What Contoso Can and Cannot Access

### 6.1 Contoso CAN:

- Enforce security policies (screen lock, encryption, OS version)
- Remotely wipe **corporate data only** (email, managed apps, company files)
- Detect whether the device is compliant with security requirements
- Require MFA for access to corporate resources

### 6.2 Contoso CANNOT:

- Read personal emails, texts, or messages
- Access personal photos, files, or browsing history
- Track the device's GPS location
- View personal app usage
- Perform a full device wipe (only corporate data is wiped)

## 7. Acceptable Use on Personal Devices

When accessing Contoso data from a personal device, employees must:

- Use only approved corporate apps (Outlook, Teams, OneDrive, SharePoint)
- Not download corporate data to unmanaged local storage
- Not screenshot or copy-paste sensitive corporate data into personal apps
- Disconnect from corporate resources when lending the device to another person
- Report loss or theft of the device to IT within **4 hours**

## 8. BYOD Stipend

Employees enrolled in the BYOD program who use a personal device as their **primary work device** (in lieu of a company laptop) are eligible for a monthly stipend:

| Device Type   | Monthly Stipend (CAD) |
| ------------- | --------------------- |
| Smartphone    | $50                   |
| Laptop/Tablet | $75                   |

The stipend is paid monthly via payroll and is taxable income. It does not apply if the employee also has a company-issued device of the same type.

## 9. Offboarding / Unenrollment

When an employee leaves Contoso or wishes to unenroll a device:

- All corporate data and apps are remotely wiped from the device.
- Personal data remains untouched.
- The device is removed from the Intune directory.
- Unenrollment requests are processed within **2 business days**.

## 10. Contact

For BYOD enrollment or issues, contact the **IT Service Desk** at **it-help@contoso.com** or ext. **5000**.
