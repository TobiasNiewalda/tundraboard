# TundrABoard Permission Model

## Mermaid.js Graph Definition

Copy and paste this code into Mermaid Live Editor or any Mermaid-compatible viewer:

```mermaid
graph TD
    %% Define Styles for Visual Differentiation
    classDef userStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#01579b;
    classDef roleStyle fill:#fff9c4,stroke:#fbc02d,stroke-width:2px,color:#333;
    classDef permissionStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px,color:#333;
    classDef moduleGroupStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#333;
    
    %% User Entities - Representing individual users in the system
    U1[User 1]:::userStyle
    U2[User 2]:::userStyle
    U3[User 3]:::userStyle
    
    %% Role Definitions - Each role has specific permission sets
    AdminRole[Admin<br/>- Full Access]:::roleStyle
    ManagerRole[Manager<br/>- Team Management]:::roleStyle
    MemberRole[Member<br/>- Standard Access]:::roleStyle
    ViewerRole[Viewer<br/>- Read Only]:::roleStyle
    
    %% Dashboard Permissions Group - Contains all dashboard-related permissions
    subgraph adminGroup [Admin Permissions Group]
        direction TB
        D1[Dashboard Permissions]
        D2[D1 - View Dashboard]
        D3[D1 - Create Reports]
        D4[D1 - Edit Reports]
        D5[D1 - Delete Reports]
        
        R1[Reports Permissions]
        R2[R1 - View Reports]
        R3[R1 - Export Reports]
        R4[R1 - Manage Report Schedules]
        
        T1[Team Permissions]
        T2[T1 - Manage Team Members]
        T3[T1 - Create Teams]
        T4[T1 - Modify Teams Settings]
        
        S1[Settings Permissions]
        S2[S1 - Manage Integrations]
        S3[S1 - Configure Global Settings]
        S4[S1 - User Management]
    end
    
    %% Manager Permissions Group
    subgraph managerGroup [Manager Permissions Group]
        direction TB
        D6[Dashboard Permissions]
        D7[D6 - View Dashboard]
        D8[D6 - Create Team Reports]
        
        R5[Reports Permissions]
        R6[R5 - View Reports]
        R7[R5 - Export Reports]
        
        T5[Team Permissions]
        T6[T5 - Manage Team Members]
        T7[T5 - Create Teams]
    end
    
    %% Member Permissions Group
    subgraph memberGroup [Member Permissions Group]
        direction TB
        D9[Dashboard Permissions]
        D10[D9 - View Dashboard]
        D11[D9 - View Team Reports]
        
        R8[Reports Permissions]
        R9[R8 - View Own Reports]
        R10[R8 - Edit Own Reports]
        
        T8[Team Permissions]
        T9[T8 - View Team Members]
        T10[T8 - Request to Join Teams]
    end
    
    %% Viewer Permissions Group
    subgraph viewerGroup [Viewer Permissions Group]
        direction TB
        D12[Dashboard Permissions]
        D13[D12 - View Public Dashboard]
        
        R11[Reports Permissions]
        R12[R11 - View Assigned Reports]
    end
    
    %% Link Users to Their Roles
    U1 -->|Has Role| AdminRole
    U2 -->|Has Role| ManagerRole
    U3 -->|Has Role| MemberRole
    
    %% Link Admin Role to All Permissions (Full Access)
    AdminRole === D2:::permissionStyle && D3:::permissionStyle && D4:::permissionStyle && D5:::permissionStyle
    AdminRole === R2:::permissionStyle && R3:::permissionStyle && R4:::permissionStyle
    AdminRole === T2:::permissionStyle && T3:::permissionStyle && T4:::permissionStyle
    AdminRole === S2:::permissionStyle && S3:::permissionStyle && S4:::permissionStyle
    
    %% Link Manager Role to Permissions (Own Teams Only)
    ManagerRole === D7:::permissionStyle && D8:::permissionStyle
    ManagerRole === R6:::permissionStyle && R7:::permissionStyle
    ManagerRole === T6:::permissionStyle && T7:::permissionStyle
    
    %% Link Member Role to Permissions (Create/Edit Own Reports, Request Teams)
    MemberRole === D10:::permissionStyle && D11:::permissionStyle
    MemberRole === R9:::permissionStyle && R10:::permissionStyle
    MemberRole === T9:::permissionStyle && T10:::permissionStyle
    
    %% Link Viewer Role to Read-Only Permissions
    ViewerRole === D13:::permissionStyle
    ViewerRole === R12:::permissionStyle
```

---

## Permission Model Documentation

### Role Descriptions

| Role | Dashboard Access | Reports Access | Team Management | Settings Access |
|-------|-----------------|----------------|-----------------|-----------------|
| **Admin** | Full | Full | Full | Full |
| **Manager** | Own Teams Only | View/Export Own | Manage Own Teams | Limited |
| **Member** | View Assigned | Create & Edit Own | Request to Join | None |
| **Viewer** | Read-only Public | Assigned Reports Only | None | None |

### Permission Categories

#### 1. Dashboard Permissions
- **View Dashboard**: Access to view the main dashboard interface
- **Create Reports**: Allow users to create new reports in their assigned dashboard
- **Edit Reports**: Modify existing reports owned by or shared with user
- **Delete Reports**: Remove reports (typically only for creators or admins)

#### 2. Reports Permissions
- **View Reports**: Read access to report content and analytics
- **Export Reports**: Download reports in PDF/CSV formats
- **Manage Schedules**: Configure automatic report generation schedules

#### 3. Team Permissions
- **Manage Members**: Add/remove team members, modify roles
- **Create Teams**: Form new teams within the organization
- **Modify Settings**: Change team configuration and settings

#### 4. Settings Permissions
- **Integrations**: Configure third-party integrations (Slack, Email, etc.)
- **Global Settings**: Modify platform-wide configurations
- **User Management**: Manage system users and their roles

---

## How to Use This Diagram

### In Mermaid Live Editor
1. Go to https://mermaid.live/
2. Copy the code block from above
3. Paste into the editor
4. View the rendered diagram

### In VS Code
1. Install Mermaid Preview extension
2. Create a `.mmd` file with this content
3. Open the file to preview the diagram

---

*Last updated: 2024-01-15*
## Complete Mermaid.js Diagram for Documentation

---