# UI Mockups Template

Use this template when creating `.planning/UI-MOCKUPS.md`.

---

```markdown
# UI Mockups: {App Name}

**Status:** {draft / approved}
**Last Updated:** {date}

## Desktop Mockups

### Login Page

```
(ASCII mockup here)
```

**Notes:** {any specific notes about this page}

---

### Dashboard

```
(ASCII mockup here)
```

**KPIs shown:** {list}
**Recent activity:** {what data}
**Quick actions:** {list}

---

### {Entity} List

```
(ASCII mockup here)
```

**Columns visible:** {list of columns}
**Actions:** {create, edit, delete, view detail}
**Filters:** {status, date, etc.}

---

### {Entity} Detail

```
(ASCII mockup here)
```

**Fields shown:** {list}
**Related records:** {child entities}
**Actions:** {edit, back}

---

### {Entity} Form (Create/Edit)

```
(ASCII mockup here)
```

**Fields:** {list with types}
**Validation:** {required fields, formats}

---

### User Management (Admin)

```
(ASCII mockup here)
```

---

### Profile

```
(ASCII mockup here)
```

---

## Mobile Mockups

### Mobile - List View

```
(ASCII mockup here - narrow viewport)
```

---

### Mobile - Dashboard

```
(ASCII mockup here - narrow viewport)
```

---

### Mobile - Navigation

```
(ASCII mockup here - hamburger menu or bottom tabs)
```

---

## Role Variations

### Viewer Role - List Page (no action buttons)

```
(Show same page but without create/edit/delete buttons)
```

---

### Public Page (if applicable)

```
(Show public-facing version of a page)
```

---

## Approval

- [ ] Login page approved
- [ ] Dashboard approved
- [ ] {Entity} list approved
- [ ] {Entity} detail approved
- [ ] {Entity} form approved
- [ ] User management approved
- [ ] Profile approved
- [ ] Mobile views approved
- [ ] Role variations approved
```

## Mockup Guidelines

### ASCII Art Rules

1. Use box-drawing characters for clean borders:
   - `┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ │ ─`

2. Use consistent widths:
   - Full page: 60 chars wide
   - Mobile: 28 chars wide

3. Show real-looking data:
   - Names: "Maria Garcia", "Pedro Lopez" (not "User 1")
   - Numbers: "$15,000", "127" (not "XXX")
   - Dates: "25/02/2026" (not "DD/MM/YYYY")

4. Show interactive elements:
   - Buttons: `[+ Nuevo]`, `[Guardar]`, `[Cancelar]`
   - Inputs: `[________________]`
   - Dropdowns: `[Activos ▾]`
   - Checkboxes: `[✓]` or `[ ]`
   - Search: `[Buscar...]`
   - Pagination: `[< Prev] 1/13 [Next >]`

5. Show role-specific elements:
   - Mark admin-only buttons: `[+ Nuevo] (admin+)`
   - Or show separate mockups per role

6. Annotate non-obvious elements:
   - `← Back button`
   - `User dropdown menu`
   - `Sidebar collapses on mobile`
