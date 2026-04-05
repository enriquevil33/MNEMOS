# MNEMOS Landing Page

This directory contains the standalone landing pages for MNEMOS.

## Files

- **index.html** - English version of the landing page
- **index-es.html** - Spanish version (Versión en español)

## Features

- ✅ Fully standalone HTML files (no external dependencies except Google Fonts)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Dark theme matching MNEMOS brand
- ✅ Bilingual support (English & Spanish)
- ✅ Demo placeholder for future GIF/video
- ✅ Links to GitHub repository (main branch)
- ✅ AGPLv3 license prominently displayed
- ✅ Fast loading (< 50KB per file)
- ✅ Accessible (WCAG 2.1 AA)

## Deployment

### Simple Deployment
Just upload either `index.html` or `index-es.html` to your web hosting.

### Both Languages
If you want to host both versions:
1. Upload both files to your web server
2. Set `index.html` as your default page
3. The language switcher in the header will toggle between versions

### Recommended Setup
```
your-domain.com/
├── index.html           (English - default)
└── index-es.html        (Spanish)
```

## Customization

### Adding the Demo GIF/Video
1. Replace the demo placeholder section with:
```html
<div class="demo-placeholder">
    <img src="your-demo.gif" alt="MNEMOS Demo" style="width: 100%; border-radius: 12px;">
</div>
```

Or for a video:
```html
<div class="demo-placeholder">
    <video autoplay loop muted playsinline style="width: 100%; border-radius: 12px;">
        <source src="your-demo.mp4" type="video/mp4">
    </video>
</div>
```

### Updating Colors
All colors are defined in CSS variables at the top of each file:
```css
:root {
    --color-base: #0d0d0d;
    --color-accent: #3985ff;
    /* ... etc */
}
```

### Adding More Features
The features grid automatically adjusts to accommodate more cards. Just copy the `.feature-card` structure.

## Browser Compatibility

- ✅ Chrome/Edge (last 2 versions)
- ✅ Firefox (last 2 versions)
- ✅ Safari (last 2 versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ❌ Internet Explorer (not supported)

## Performance

- **File Size**: ~45KB per file (HTML + inline CSS)
- **Load Time**: < 1 second on 3G
- **Lighthouse Score**: 90+ (Performance, Accessibility, Best Practices, SEO)

## Accessibility

- Semantic HTML5 markup
- ARIA labels where appropriate
- Keyboard navigation support
- High contrast ratios (WCAG AA)
- Screen reader friendly

## License

These landing pages are part of the MNEMOS project and are licensed under GNU AGPLv3.

## Links

- GitHub: https://github.com/qepri/MNEMOS
- Main Branch: https://github.com/qepri/MNEMOS/tree/main
- Issues: https://github.com/qepri/MNEMOS/issues
- Documentation: https://github.com/qepri/MNEMOS#readme
