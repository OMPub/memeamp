# Copilot Instructions for memeamp

This repository appears to be a Next.js/TypeScript project based on the configuration files.

## Project Structure

- This is a Next.js application with TypeScript support
- Dependencies are managed via npm or yarn
- Build output goes to `.next/` and `out/` directories
- Production builds go to `build/`

## Code Conventions

### TypeScript
- Always use TypeScript for new files
- Ensure type safety and avoid using `any` unless absolutely necessary
- Keep `tsconfig.json` strict settings enabled

### Code Style
- Follow existing code formatting and style in the repository
- Use meaningful variable and function names
- Add comments for complex logic

## Development Workflow

### Setup
```bash
npm install
```

### Development
```bash
npm run dev
```

### Building
```bash
npm run build
```

### Testing
- Always write tests for new features
- Run tests before committing changes
- Tests should be co-located with the code they test when possible

### Linting
- Follow ESLint rules if configured
- Fix linting errors before committing

## Environment Variables
- Never commit `.env` files or any sensitive credentials
- Use `.env.local` for local development secrets
- Document required environment variables in README.md

## Dependencies
- Keep dependencies up to date
- Prefer established, well-maintained packages
- Always check for security vulnerabilities before adding new dependencies
- Document why each dependency is needed

## Pull Requests
- Keep changes focused and minimal
- Write clear commit messages
- Update documentation if needed
- Ensure all tests pass before requesting review

## Best Practices
- Follow the Next.js best practices and conventions
- Optimize for performance and accessibility
- Write semantic HTML
- Use React best practices (hooks, component composition, etc.)
- Handle errors gracefully
- Add loading states for async operations
