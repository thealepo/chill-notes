# Dependency security

`npm run audit:prod` checks dependencies that ship in the browser bundle and fails on any advisory, including low-severity findings. It is part of `npm run check`, so pull requests and pushes to `main` cannot pass the quality workflow with a known production dependency advisory.

## Current audit status

Audit snapshot: November 2, 2026.

- Production dependencies: 0 advisories.
- Development dependencies: 21 advisories (19 moderate and 2 low; no high or critical findings).
- KaTeX is upgraded to 0.19.1 and link-capable commands remain explicitly untrusted while rendering user-authored equations.
- Vite is upgraded to 6.4.5, which resolves the reported development-server advisory.
- All non-breaking fixes offered by `npm audit fix` are applied in the lockfile.

The unresolved findings are transitive dependencies of the ESLint and Workbox/PWA build pipelines. They run only while linting or generating the application bundle from trusted repository files; they are not included in the browser application or service worker at runtime. The remaining automatic fixes currently proposed by npm require incompatible dependency changes, including downgrading `vite-plugin-pwa`. Those changes are intentionally not forced because they could regress the offline/update behavior without eliminating a production exposure.

Dependabot checks npm and GitHub Actions dependencies monthly. Re-run the full `npm audit` when dependency updates land, apply compatible fixes, and revise this snapshot when the remaining upstream fixes become available.
