# Development Workflow

## 🚀 Quick Start

1. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd video_web_app_v3
   ./setup.sh
   ```

2. **Start development**:
   ```bash
   npm run dev
   ```

## 📦 Dependency Management

### Python (using uv)
- **Install**: `uv sync`
- **Update all**: `uv sync --upgrade`
- **Add package**: `uv add package_name`
- **Remove package**: `uv remove package_name`

### Node.js (using npm)
- **Install**: `npm install`
- **Update all**: `npm update`
- **Add package**: `npm install package_name`
- **Remove package**: `npm uninstall package_name`

## 🔧 Environment Setup

The project uses flexible versioning:
- **Python**: No version pins in `pyproject.toml` - always gets latest
- **Node.js**: Uses `^` versioning for flexible updates
- **Lock files**: `uv.lock` and `package-lock.json` are auto-generated

## 📝 Daily Development Workflow

1. **Start work**:
   ```bash
   git pull origin main
   uv sync  # Update Python deps if needed
   npm install  # Update Node deps if needed
   npm run dev
   ```

2. **Add new Python package**:
   ```bash
   uv add package_name
   # Package automatically added to pyproject.toml
   ```

3. **Add new Node package**:
   ```bash
   npm install package_name
   # Package automatically added to package.json
   ```

4. **Commit changes**:
   ```bash
   git add pyproject.toml package.json
   git commit -m "Add new package: package_name"
   ```

## 🎯 Benefits of This Setup

- **Always latest**: No version conflicts or outdated packages
- **Easy updates**: Simple commands to update everything
- **Smooth deployment**: No version pin conflicts
- **Team friendly**: Everyone gets the same latest versions
- **Fast development**: No need to manage specific versions

## ⚠️ Important Notes

- **Lock files**: Don't commit `uv.lock` or `package-lock.json` during active development
- **Version control**: Only commit `pyproject.toml` and `package.json`
- **Production**: Lock files can be generated for production deployments
- **Testing**: Always test with latest versions to catch compatibility issues early
