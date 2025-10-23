# ?? Quick Reference Guide

## File Locations

```
IPTSYSTEM/
??? wwwroot/css/
?   ??? site.css   ? Core layout & header
?   ??? pages/
?       ??? home.css    ? Landing page
?       ??? categories.css    ? Categories page
?       ??? mylistings.css    ? My Listings page
?       ??? messages.css      ? Messages page
?
??? Views/
?   ??? Home/
?   ?   ??? Landing.cshtml    ? Uses home.css
?   ?   ??? Categories.cshtml ? Uses categories.css
?   ?   ??? Mylisting.cshtml  ? Uses mylistings.css
?   ?   ??? Messages.cshtml   ? Uses messages.css
?   ??? Shared/
?       ??? _Layout.cshtml    ? Includes all CSS
?
??? Documentation/
    ??? CSS_ARCHITECTURE.md    ? Full documentation
    ??? MODERNIZATION_SUMMARY.md ? This summary
```

---

## ?? Design System (from site.css)

### Colors
```css
--text-black: #000000;   /* Primary text */
--dark-gray: #1f2937;    /* Secondary text */
--medium-gray: #6b7280;   /* Tertiary text */
--light-gray: #f3f4f6;          /* Backgrounds */
--border-color: #e5e7eb;        /* Borders */
--success-green: #10b981;   /* Success states */
--danger-red: #ef4444;   /* Error states */
--primary-purple: #7c3aed;      /* AI Assistant */
```

### Spacing
```css
--header-height: 72px;          /* Fixed header */
```

### Typography
- Font: **Inter** (400, 500, 600, 700, 800)
- Base: **14px** (mobile), **16px** (desktop)

---

## ?? Page-Specific Classes

### Home (home.css)
```css
.hero-yellow      /* Hero section */
.hero-main-heading-yellow       /* Main heading */
.btn-browse-yellow     /* Browse button */
.btn-start-selling-yellow    /* Start selling button */
.latest-items-section      /* Items section */
.item-card     /* Item card */
.item-badge                  /* Condition badge */
.btn-wishlist  /* Heart icon */
```

### Categories (categories.css)
```css
.categories-page           /* Page container */
.category-card    /* Category card */
.category-icon-wrapper          /* Icon container */
.category-icon            /* Category icon */
.category-name          /* Category name */
.category-count       /* Item count */
```

### My Listings (mylistings.css)
```css
.my-listings-page       /* Page container */
.listings-page-title     /* Page title */
.btn-add-listing         /* Add button */
.filters-bar        /* Filters container */
.listing-card             /* Listing card */
.listing-image-wrapper   /* Image container */
.listing-overlay  /* Hover overlay */
.btn-edit  /* Edit button */
.btn-delete   /* Delete button */
.listing-modal-enhanced         /* Modal styling */
```

### Messages (messages.css)
```css
.messages-page        /* Page container */
.btn-ai-assistant               /* AI button */
.messages-container        /* Main container */
.conversations-panel    /* Left panel */
.conversation-item     /* Conversation */
.chat-panel     /* Right panel */
.chat-header   /* Chat header */
.chat-messages      /* Messages area */
.message-bubble                 /* Message */
.chat-input-container           /* Input area */
```

---

## ?? Common Tasks

### Adding Styles to a Page

```razor
@{
    ViewData["Title"] = "Page Title";
}

@section Styles {
    <link rel="stylesheet" href="~/css/pages/yourpage.css" asp-append-version="true" />
}

<!-- Your content -->
```

### Creating a New Page

1. **Create CSS:**
   ```
   wwwroot/css/pages/newpage.css
   ```

2. **Add styles:**
   ```css
   /* ========== NEW PAGE - MODERN DESIGN ========== */
   .newpage-container { }
   ```

3. **Link in view:**
   ```razor
   @section Styles {
       <link rel="stylesheet" href="~/css/pages/newpage.css" />
   }
   ```

### Using Design Variables

```css
.my-element {
    color: var(--text-black);
  background: var(--light-gray);
    border: 1px solid var(--border-color);
}
```

---

## ?? Responsive Breakpoints

```css
/* Mobile First */
.my-element { }

/* Tablet */
@media (max-width: 991px) { }

/* Mobile */
@media (max-width: 767px) { }
```

---

## ?? Common Patterns

### Card with Hover

```css
.my-card {
    border-radius: 20px;
    transition: all 0.4s ease;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.my-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14);
}
```

### Button with Gradient

```css
.my-button {
    background: linear-gradient(135deg, #000000 0%, #1f2937 100%);
    border-radius: 12px;
  transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.my-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}
```

### Input with Focus

```css
.my-input {
    border: 1.5px solid var(--border-color);
    border-radius: 10px;
    transition: all 0.3s ease;
}

.my-input:focus {
    outline: none;
    border-color: var(--text-black);
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.05);
}
```

---

## ? Testing Checklist

- [ ] Build successful (no errors)
- [ ] All pages load correctly
- [ ] Styles apply properly
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Hover effects work
- [ ] Navigation active states work
- [ ] Forms validate correctly
- [ ] Modals open/close
- [ ] Images load
- [ ] Browser cache cleared

---

## ?? Troubleshooting

### Styles Not Loading?
1. Clear cache: `Ctrl+Shift+R`
2. Check browser console
3. Verify file path
4. Rebuild project

### Style Conflicts?
1. Check CSS specificity
2. Use developer tools
3. Verify class names
4. Check cascade order

### Layout Issues?
1. Check box model (padding/margin)
2. Verify flexbox/grid setup
3. Test on different screens
4. Check for overflow issues

---

## ?? Need Help?

1. **Full docs:** `CSS_ARCHITECTURE.md`
2. **Summary:** `MODERNIZATION_SUMMARY.md`
3. **This guide:** `QUICK_REFERENCE.md`

---

## ?? You're All Set!

Your modern CSS architecture is ready to use. Happy coding! ??
