# Software Installation & Licensing Policy

**Policy ID:** IT-POL-008  
**Effective Date:** January 1, 2025  
**Last Revised:** May 25, 2025  
**Approved By:** James Park, Chief Information Security Officer

---

## 1. Purpose

This policy governs the installation, licensing, and management of software on all Contoso Ltd. devices to ensure compliance, security, and cost control.

## 2. Scope

This policy applies to all software installed on Contoso-managed devices, including desktops, laptops, servers, and virtual machines.

## 3. Approved Software Catalog

Contoso maintains an **Approved Software Catalog** in the IT Self-Service Portal. Software in the catalog has been vetted for security, licensing compliance, and compatibility.

### 3.1 Self-Service Installation

Employees may install any software from the Approved Catalog **without IT approval** using the **Company Portal** (Microsoft Intune). Common approved software includes:

| Category            | Examples                                            |
| ------------------- | --------------------------------------------------- |
| Productivity        | Microsoft 365, Adobe Acrobat, Slack                  |
| Development         | Visual Studio Code, Git, Docker Desktop, Node.js     |
| Design              | Figma, Adobe Creative Cloud (licensed roles only)    |
| Collaboration       | Microsoft Teams, Zoom, Miro                          |
| Security            | Microsoft Defender, 1Password                        |
| Utilities           | 7-Zip, Notepad++, PowerToys                          |

### 3.2 Software Not in the Catalog

To request software not in the Approved Catalog:

1. Submit a **Software Request** via the IT Self-Service Portal.
2. Provide business justification and the software name, version, and vendor.
3. The IT Security Team evaluates the software for security risks (**5 business days**).
4. The IT Procurement Team verifies licensing and cost (**5 business days**).
5. If approved, the software is added to the catalog and deployed.

Requests may be denied if the software poses unacceptable security risks or if a suitable approved alternative exists.

## 4. Prohibited Software

The following categories of software are **strictly prohibited** on Contoso devices:

- Peer-to-peer (P2P) file sharing applications (e.g., BitTorrent, LimeWire)
- Hacking or network exploitation tools (unless pre-authorized for security team use)
- Unlicensed or pirated software
- Cryptocurrency mining software
- Personal VPN or proxy applications
- Browser extensions not in the approved list

Installation of prohibited software is a violation of this policy and IT-POL-010 (Acceptable Use) and may result in disciplinary action.

## 5. Licensing Compliance

- All software on Contoso devices must be properly licensed.
- Contoso uses **Microsoft Entra ID** and **Intune** for license tracking and assignment.
- The IT Procurement Team conducts quarterly license audits.
- Unused licenses are reclaimed after **90 days** of inactivity.
- Employees must not transfer, share, or re-distribute software licenses.

## 6. Open-Source Software

Open-source software may be used provided:

- It is listed in the Approved Catalog, OR
- A Software Request has been approved, AND
- The license terms (e.g., GPL, MIT, Apache) have been reviewed by Legal for compatibility with Contoso's products and intellectual property.

Developers must maintain a **Software Bill of Materials (SBOM)** for all open-source dependencies in production projects.

## 7. Automatic Updates

- Operating system updates are managed centrally via **Windows Update for Business** and **Munki** (macOS).
- Critical security patches are deployed within **72 hours** of release.
- Feature updates are deployed within **30 days** of release.
- Employees must not defer or disable automatic updates.

## 8. Shadow IT

The IT Security Team actively monitors for unauthorized software and cloud services (shadow IT). Detected shadow IT is:

1. Flagged for review.
2. Evaluated for business need and security risk.
3. Either approved and added to the catalog, or blocked and removed.

## 9. Contact

For software requests or licensing questions, contact the **IT Service Desk** at **it-help@contoso.com** or ext. **5000**.
