```markdown
# shuiyinxiangji Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `shuiyinxiangji` TypeScript codebase, which is built with the Vite framework. You'll learn how to structure files, write imports/exports, and follow the project's commit and testing conventions. This guide is designed to help contributors quickly align with the project's style and workflows.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `watermarkGenerator.ts`, `imageUploader.tsx`

### Import Style
- Use **relative imports** for modules within the project.
  ```typescript
  import watermark from './watermarkGenerator';
  import { uploadImage } from '../utils/imageUploader';
  ```

### Export Style
- Use **default exports** for modules.
  ```typescript
  // watermarkGenerator.ts
  const watermark = () => { /* ... */ };
  export default watermark;
  ```

### Commit Patterns
- Commit messages are **freeform** and may use various prefixes.
- Average commit message length: ~36 characters.
  - Example: `fix image upload bug`
  - Example: `add watermark position option`

## Workflows

### Project Setup
**Trigger:** When starting development or onboarding a new environment  
**Command:** `/setup`

1. Clone the repository.
2. Install dependencies with your preferred package manager (e.g., `npm install` or `yarn`).
3. Start the development server using Vite:
   ```bash
   npm run dev
   ```

### Adding a New Module
**Trigger:** When implementing a new feature or utility  
**Command:** `/add-module`

1. Create a new file using camelCase naming (e.g., `featureName.ts`).
2. Implement the module logic.
3. Export the module as default.
   ```typescript
   // featureName.ts
   const featureName = () => { /* ... */ };
   export default featureName;
   ```
4. Import the module where needed using a relative path.

### Writing a Test
**Trigger:** When adding or updating functionality  
**Command:** `/write-test`

1. Create a test file alongside the module using the pattern `*.test.*` (e.g., `featureName.test.ts`).
2. Write tests using the project's preferred testing framework (framework is currently unknown).
3. Run the tests using the appropriate command (e.g., `npm test` or framework-specific command).

## Testing Patterns

- Test files follow the pattern: `*.test.*`
  - Example: `watermarkGenerator.test.ts`
- The specific testing framework is not detected; check existing test files for framework usage.
- Place test files near the modules they test or in a dedicated `tests` directory if present.

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /setup       | Set up the project for development           |
| /add-module  | Add a new module following conventions       |
| /write-test  | Write a test for a module or feature         |
```
