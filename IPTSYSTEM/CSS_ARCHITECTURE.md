# CSS Architecture Documentation

## Overview
The CSS has been reorganized into a modern, modular architecture to improve maintainability, reduce conflicts, and provide a clean separation of concerns. Each page now has its own dedicated CSS file.

---

## File Structure

```
IPTSYSTEM/
??? wwwroot/
    ??? css/
   ??? site.css        # Core layout & header styles
        ??? pages/
     ??? home.css          # Landing page styles
      ??? categories.css # Categories page styles
 ??? mylistings.css    # My Listings page styles
            ??? messages.css      # Messages page styles
```

---

## Core Files

### 1. **site.css** - Core Layout & Navigation
**Purpose:** Contains only global styles, layout structure, and header/navigation components.

**Includes:**
- Design system variables (colors, spacing, etc.)
- Base HTML/body styles
- Modern header and navigation
- Brand logo and navigation links
- Search bar in header
- Action icons (cart, profile, admin button)
- Global utility classes

**What was removed:**
- All page-specific styles (hero sections, item cards, listings, messages, etc.)

---

## Page-Specific CSS Files

### 2. **pages/home.css** - Landing Page
**Purpose:** Styles for the home/landing page only.

**Includes:**
- Hero section with yellow shopping theme
- Shopping background and overlay
- Animated shopping items decoration
- Hero content (heading, description, buttons)
- Latest Items section
- Item cards with hover effects
- Item badges (Like New, Good, New, Fair)
- Wishlist button
- Item details (title, description, price, rating)
- Sort dropdown
- Responsive styles for mobile

**Used by:** `Views/Home/Landing.cshtml` (Index action)

---

### 3. **pages/categories.css** - Categories Page
**Purpose:** Styles for the categories browsing page.

**Includes:**
- Categories page layout and background
- Page header (title, subtitle)
- Category cards with hover animations
- Category icon wrappers with gradient backgrounds
- Category icon hover effects (rotation, scale)
- Category name and item count
- Responsive grid layouts

**Used by:** `Views/Home/Categories.cshtml`

---

### 4. **pages/mylistings.css** - My Listings Page
**Purpose:** Styles for the user's listings management page.

**Includes:**
- My Listings page layout
- Page header with statistics
- Add listing button
- Advanced filters bar (search, category, condition, sort)
- View toggle (grid/list)
- Bulk actions bar
- Listing cards (grid and list views)
- Listing image wrapper and overlay
- Listing badges (condition indicators)
- Quick action buttons (view, duplicate)
- Listing details (title, description, price, views)
- Action buttons (edit, delete)
- Empty state
- Modal styles (add/edit listing)
- Image upload section
- Image preview box
- Form inputs and validation
- Condition selector buttons
- Character counters
- Pagination
- Toast notifications
- Responsive styles

**Used by:** `Views/Home/Mylisting.cshtml`

---

### 5. **pages/messages.css** - Messages Page
**Purpose:** Styles for the messaging/chat interface.

**Includes:**
- Messages page layout
- Page header with AI assistant button
- Messages container (2-column layout)
- Conversations panel
  - Search conversations input
  - Conversation list
  - Conversation items
  - AI conversation special styling
  - Avatar with online/offline indicator
  - Unread badge
- Chat panel
  - Chat header with user info
  - Chat empty state
  - Chat messages (bubbles for sent/received)
  - AI message special styling
  - Chat input container
  - Send button
- Chat options dropdown
- Toast notifications
- Custom scrollbar styling
- Responsive styles (mobile single column)

**Used by:** `Views/Home/Messages.cshtml`

---

## How to Use

### Adding Page-Specific Styles

Each Razor page now includes a `@section Styles` block that links to its dedicated CSS file:

```razor
@section Styles {
  <link rel="stylesheet" href="~/css/pages/[page-name].css" asp-append-version="true" />
}
```

**Example:**
```razor
@{
    ViewData["Title"] = "My Listings";
}

@section Styles {
    <link rel="stylesheet" href="~/css/pages/mylistings.css" asp-append-version="true" />
}

<!-- Page content here -->
```

### Layout Integration

The `_Layout.cshtml` file includes the render section for styles:

```razor
<link rel="stylesheet" href="~/css/site.css" asp-append-version="true" />
@await RenderSectionAsync("Styles", required: false)
```

This ensures:
1. Core `site.css` is loaded first (header, navigation, global styles)
2. Page-specific CSS is loaded only when needed
3. No style conflicts between pages

---

## Design System Variables

All pages use the same design system defined in `site.css`:

```css
:root {
    --primary-blue: #2563eb;
    --primary-purple: #7c3aed;
    --dark-gray: #1f2937;
    --medium-gray: #6b7280;
    --light-gray: #f3f4f6;
    --border-color: #e5e7eb;
    --success-green: #10b981;
    --danger-red: #ef4444;
    --header-height: 72px;
    --text-black: #000000;
}
```

**Benefits:**
- Consistent color scheme across all pages
- Easy to update colors globally
- Better maintainability

---

## Modern Design Features

### Consistent Design Language

**All pages share:**
- Inter font family with smooth anti-aliasing
- Black text for primary content (#000000)
- Gray scale for secondary content
- Rounded corners (10px-24px border-radius)
- Box shadows for depth
- Smooth transitions (0.3s-0.4s)
- Hover effects (translateY, scale, color changes)

### Responsive Design

**Breakpoints:**
- Desktop: 1200px+
- Tablet: 768px-1199px
- Mobile: 0-767px

**Each page CSS includes:**
- Fluid typography (clamp, rem units)
- Responsive grid layouts
- Mobile-first approach
- Touch-friendly buttons (min 44px)
- Optimized spacing for small screens

---

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Core layout separate from page-specific styles
- Each page maintains its own CSS
- No style conflicts between pages

### 2. **Performance**
- Only load CSS needed for the current page
- Smaller CSS files = faster load times
- Browser can cache individual files

### 3. **Maintainability**
- Easy to find and modify styles for a specific page
- Clear organization and naming
- No need to scroll through massive CSS files

### 4. **Scalability**
- Adding new pages is straightforward
- Create new CSS file in `/pages/` folder
- Link it using `@section Styles`
- No impact on existing pages

### 5. **Team Collaboration**
- Multiple developers can work on different pages
- Reduced merge conflicts
- Clear ownership of styles

---

## Naming Conventions

### CSS Classes

**Page-specific prefix:**
- `.hero-yellow-*` - Landing page hero section
- `.category-*` - Categories page components
- `.listing-*` - My Listings page components
- `.conversation-*`, `.chat-*` - Messages page components

**Component-based naming:**
- `.card` - Card container
- `.card-header` - Card header section
- `.card-body` - Card body content
- `.card-footer` - Card footer actions

**State classes:**
- `.active` - Active state
- `.disabled` - Disabled state
- `.is-valid` - Validation success
- `.is-invalid` - Validation error

**Utility classes (from site.css):**
- `.page-content` - Main content wrapper
- `.modern-header` - Header container
- `.modern-nav-link` - Navigation link

---

## Best Practices

### DO ?

1. **Keep page styles in their respective CSS files**
2. **Use design system variables for colors**
3. **Follow the existing naming conventions**
4. **Include responsive styles in the same file**
5. **Add comments to explain complex styles**
6. **Test on multiple screen sizes**
7. **Keep specificity low (avoid deep nesting)**

### DON'T ?

1. **Don't add page-specific styles to site.css**
2. **Don't use inline styles in Razor pages**
3. **Don't use !important unless absolutely necessary**
4. **Don't hardcode colors (use variables)**
5. **Don't create deeply nested selectors**
6. **Don't forget mobile responsiveness**

---

## Adding a New Page

**Steps:**

1. **Create CSS file:**
   ```
   IPTSYSTEM/wwwroot/css/pages/newpage.css
   ```

2. **Add styles:**
   ```css
   /* ========== NEW PAGE - MODERN DESIGN ========== */
   
   .newpage-container {
    /* Your styles */
   }
   ```

3. **Link in Razor view:**
   ```razor
   @{
  ViewData["Title"] = "New Page";
   }
   
   @section Styles {
   <link rel="stylesheet" href="~/css/pages/newpage.css" asp-append-version="true" />
   }
   
   <!-- Page content -->
   ```

4. **Test and verify:**
   - Build the project
   - Check browser console for errors
   - Test responsiveness
   - Verify no style conflicts

---

## Troubleshooting

### Styles not applying?

1. **Check the section syntax:**
   ```razor
 @section Styles {
       <link rel="stylesheet" href="~/css/pages/yourpage.css" asp-append-version="true" />
   }
   ```

2. **Verify file path is correct**

3. **Clear browser cache** (Ctrl+Shift+R)

4. **Check browser console** for 404 errors

5. **Rebuild the project**

### Style conflicts?

1. **Check CSS specificity**
2. **Ensure page-specific classes are unique**
3. **Avoid using generic class names**
4. **Use developer tools to inspect computed styles**

---

## Maintenance

### Regular Tasks

1. **Review and remove unused styles**
2. **Update design system variables as needed**
3. **Optimize CSS for performance**
4. **Keep responsive styles updated**
5. **Document any major changes**

### When Updating Styles

1. **Test on all breakpoints**
2. **Check for accessibility (contrast, focus states)**
3. **Verify browser compatibility**
4. **Update this documentation if structure changes**

---

## Summary

The new CSS architecture provides:
- ? Clean separation of concerns
- ? Improved performance
- ? Better maintainability
- ? Scalable structure
- ? Modern design system
- ? Responsive across all devices
- ? Easy to understand and modify

**All pages maintain a consistent, modern design while keeping their styles isolated and manageable.**

---

*Last updated: 2024*
