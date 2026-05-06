# Ethos APIs Static Deployment

This project is a modified static Scalar-based API catalog. It can be deployed to a standard web server that can serve HTML, JavaScript, JSON, YAML, and static folders.

## Required Files

Deploy the application files together so the relative paths continue to work. The deployed directory should include:

```text
index.html
catalog.css
catalog.js
scalar-manifest.json
scalar-search-index.json
ethosapis/
OA3 Client Libraries/
```

## Note
- The page loads Scalar from `https://cdn.jsdelivr.net/npm/@scalar/api-reference`.
