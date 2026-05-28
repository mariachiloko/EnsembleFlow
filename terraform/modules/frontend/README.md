# Frontend Module

Hosts the built React/Vite app with:

- private S3 bucket for static files
- CloudFront distribution for public HTTPS access
- Origin Access Control so the bucket is not public
- SPA fallback to `index.html` for client-side routes
