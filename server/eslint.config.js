import tseslint from 'typescript-eslint';
export default tseslint.config({files:['**/*.{ts,tsx}'],ignores:['**/dist/**','**/node_modules/**'],extends:[...tseslint.configs.recommended],rules:{'@typescript-eslint/no-explicit-any':'off'}});
