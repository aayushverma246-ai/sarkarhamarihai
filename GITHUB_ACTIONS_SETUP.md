# GitHub Actions & Vercel Setup

This guide explains how to enable automatic deployment to Vercel using GitHub Actions.

1. Create a Vercel Personal Token
   - Open: https://vercel.com/account/tokens
   - Create a token (name it e.g. "github-actions-deploy")
   - Copy the token value (keep it secret)

2. Add GitHub repository secrets
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - VERCEL_TOKEN: <your vercel token>
     - VERCEL_ORG_ID: <your vercel org id> (optional)
     - VERCEL_PROJECT_ID: <your vercel project id> (optional)

   To find Project & Org ID: check your Vercel project settings or .vercel/project.json in the repo.

3. Push workflow file
   - The workflow file is at `.github/workflows/vercel-deploy.yml`
   - Commit and push to `main` branch to trigger deployment

4. Trigger deployment manually
   - From GitHub Actions tab, run the workflow (workflow_dispatch)

5. Troubleshooting
   - If the action fails with authentication errors, verify VERCEL_TOKEN
   - If build fails, run `npm run build` locally to inspect errors

6. Alternative: Use Vercel Git Integration
   - Connect the repository in Vercel dashboard and Vercel will deploy on push automatically.

After setup, each push to `main` will trigger a production deployment to Vercel.