# Sports Background Images

## How to Add Your Own Open Source Sports Background Image

### Step 1: Find a Free Sports Background Image
Visit these free image resources:
- **Unsplash**: https://unsplash.com/s/photos/sports-background
- **Pexels**: https://www.pexels.com/search/sports%20background/
- **Pixabay**: https://pixabay.com/images/search/sports%20background/
- **Freepik**: https://www.freepik.com/free-photos-vectors/sports-background

### Step 2: Download and Add the Image
1. Download your chosen sports background image
2. Rename it to `sports-background.jpg` (or .png)
3. Place it in this `/public/images/` folder

### Step 3: Update the Background
In `/app/page.tsx`, replace the current background style with:

```tsx
style={{
  backgroundImage: `
    linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 58, 138, 0.6), rgba(15, 23, 42, 0.7)),
    url('/images/sports-background.jpg')
  `
}}
```

### Recommended Image Specifications
- **Resolution**: 1920x1080 or higher
- **Format**: JPG or PNG
- **Content**: Sports equipment, courts, or athletic scenes
- **License**: Free for commercial use

### Current Implementation
The current background uses a CSS-generated pattern with sports-themed gradients and overlays. This provides a professional look while being lightweight and fast-loading.
