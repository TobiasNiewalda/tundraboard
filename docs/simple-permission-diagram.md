# TundrABoard Simple Permission Diagram

## Visual Role Hierarchy

```mermaid
graph LR
    subgraph Admin["Admin Level"]
        A1[Dashboard<br/>(All)]
        A2[Reports<br/>(Full)]
        A3[Teams<br/>(Manage All)]
        A4[Settings<br/>(All)]
    end
    
    subgraph Manager["Manager Level"]
        M1[Dashboard<br/>(Own Teams)]
        M2[Reports<br/>(View/Export)]
        M3[Teams<br/>(Own Only)]
    end
    
    subgraph Member["Member Level"]
        MEM1[Dashboard<br/>(View Own)]
        MEM2[Reports<br/>(Create/Edit Own)]
        MEM3[Teams<br/>(Request Join)]
    end
    
    subgraph Viewer["Viewer Level"]
        V1[Dashboard<br/>(Public Only)]
        V2[Reports<br/>(Assigned)]
    end
    
    Admin --> Manager
    Manager --> Member
    Member -.-> Viewer
```

---

## Quick Reference Table

| Feature | Admin | Manager | Member | Viewer |
|---------|--------|---------|--------|--------|
| View Own Reports | ✅ | ✅ | ✅ | ⚠️* |
| Create New Reports | ✅ | ⚠️** | ✅ | ❌ |
| Edit Own Reports | ✅ | ✅ | ✅ | ❌ |
| Delete Reports | ✅ | ❌ | ❌ | ❌ |
| Manage Team Members | ✅ | ✅ | ❌ | ❌ |
| Create Teams | ✅ | ✅ | ❌ | ❌ |
| Export Reports | ✅ | ✅ | ✅ | ⚠️* |
| Configure Settings | ✅ | ⚠️** | ❌ | ❌ |

⚠️ = Limited/Context-dependent  
❌ = Not permitted  
✅ = Full permission  

---

## Usage Instructions

### For Developers
Use the detailed `permission-model.md` file for implementation and backend logic.

### For Documentation Sites
1. Copy either diagram block
2. Paste into your documentation platform (GitBook, Docusaurus, MkDocs)
3. The simple diagram works well in README files and quick reference guides

### For UI Implementation
The permission structure follows this pattern:
```javascript
const permissions = {
  admin: { dashboard: '*', reports: '*', teams: '*', settings: '*' },
  manager: { dashboard: 'own', reports: ['view', 'export'], teams: 'own' },
  member: { dashboard: 'view', reports: ['create_own', 'edit_own'], teams: 'request' },
  viewer: { dashboard: 'public', reports: 'assigned' }
};
```

---

*Generated for TundrABoard v1.0*