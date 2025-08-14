# Contributing to Video Learning Web App

Thank you for your interest in contributing to the Video Learning Web App! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.12+
- uv (Python package manager)
- yt-dlp (for video transcript extraction)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/video-learning-web-app.git
   cd video-learning-web-app
   ```

2. **Install Dependencies**
   ```bash
   # Frontend
   npm install
   
   # Backend
   uv sync
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Install yt-dlp**
   ```bash
   # macOS
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo apt install yt-dlp
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📝 Development Guidelines

### Code Style

**JavaScript/React:**
- Use ESLint configuration (already configured)
- Follow React best practices
- Use functional components with hooks
- Prefer TypeScript for new files

**Python:**
- Follow PEP 8 style guide
- Use type hints
- Keep functions small and focused
- Add docstrings for public functions

### Git Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clear, descriptive commit messages
   - Keep commits atomic and focused
   - Test your changes thoroughly

3. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🧪 Testing

### Frontend Testing
```bash
npm run lint
```

### Backend Testing
```bash
# Run Python tests (when implemented)
uv run pytest
```

## 📋 Issue Reporting

When reporting issues, please include:

1. **Environment Information**
   - OS and version
   - Node.js version
   - Python version
   - Browser (if applicable)

2. **Steps to Reproduce**
   - Clear, step-by-step instructions
   - Expected vs actual behavior

3. **Additional Context**
   - Screenshots (if applicable)
   - Error messages
   - Console logs

## 🎯 Feature Requests

When suggesting new features:

1. **Describe the Problem**
   - What problem does this solve?
   - Who would benefit from this feature?

2. **Propose a Solution**
   - How should this feature work?
   - Any technical considerations?

3. **Consider Implementation**
   - Is this within the project's scope?
   - What would be the effort required?

## 🤝 Pull Request Guidelines

### Before Submitting

1. **Test Your Changes**
   - Ensure all tests pass
   - Test on different browsers (if applicable)
   - Verify functionality works as expected

2. **Update Documentation**
   - Update README if needed
   - Add inline documentation
   - Update API documentation

3. **Check Code Quality**
   - Run linters
   - Ensure code follows style guidelines
   - Remove any debugging code

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing
- [ ] Tests pass
- [ ] Manual testing completed
- [ ] No breaking changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
```

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Python Documentation](https://docs.python.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 🆘 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check README.md and inline docs first

Thank you for contributing to the Video Learning Web App! 🎉 