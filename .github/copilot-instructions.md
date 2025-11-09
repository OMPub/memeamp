# Copilot Instructions for memeamp

This is a pure frontend basic site built from a Vite template.

## Project Structure

- This is a Vite-based frontend application with TypeScript support
- TypeScript code is compiled down to HTML/CSS/JS
- Dependencies are managed via npm or yarn
- Build output goes to `dist/` directory
- Development server runs via Vite

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
- Follow Vite best practices and conventions
- Optimize for performance and accessibility
- Write semantic HTML
- Keep the frontend lightweight and fast
- Handle errors gracefully
- Use modern JavaScript/TypeScript features
