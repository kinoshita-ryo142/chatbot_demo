# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Gemini API キーの設定（ローカル開発） 🔒

- ルートに `.env` または `.env.local` を作成し、次を追加してください（例）:

  ```text
  VITE_GEMINI_API_KEY=your_gemini_api_key_here
  ```

  既存の例ファイルがある場合はコピーできます:
  - macOS / Linux: `cp .env.example .env`
  - Windows (PowerShell): `copy .env.example .env`

- 変更後は開発サーバーを再起動してください（Vite は起動時に env を読み込みます）。

- セキュリティ: `.env` ファイルは `.gitignore` に追加済みです。API キーをリポジトリにコミットしないでください。

- 動作: `VITE_GEMINI_API_KEY` を設定するとアプリの Gemini モードが有効になります。設定がない場合は既存の Mock モードで動作します.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Deploy to Vercel 🚀

Recommended: connect your GitHub repo to Vercel for automatic deploys. Alternatively the repository includes a GitHub Actions workflow that runs on pushes to `main` and deploys using the Vercel CLI.

1. Create a Vercel project and connect the GitHub repository, or use the included GitHub Action (push to `main`).

2. Add the following secrets in GitHub (Repository → Settings → Secrets):
   - `VERCEL_TOKEN` — your Vercel personal token (required for the Action)
   - `VERCEL_ORG_ID` (optional) — your Vercel org id
   - `VERCEL_PROJECT_ID` (optional) — your Vercel project id

3. Add the runtime environment variable in Vercel (Project Settings → Environment Variables):
   - `VITE_GEMINI_API_KEY` — your Gemini API key (do NOT commit this to git)

4. The repository already contains `vercel.json` (build config) and `.github/workflows/deploy-vercel.yml` (CI-deploy). The GitHub Action runs `npm run build` and deploys the `dist` output.

5. To trigger a deployment now: push your branch to `main` or run the `Deploy to Vercel` workflow from the Actions tab.

Notes:
- After first deploy, confirm environment variables and web root in Vercel dashboard if necessary.
- If you prefer Vercel Git Integration, you can omit the GitHub Action and let Vercel handle builds automatically.
