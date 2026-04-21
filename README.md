# Pochade-JS Project

A vanilla JS, CSS and HTML project with Web Workers and Custom HTML Elements as first class citizens.

## Getting Started

Install dependencies:

```bash
npm install
```

## Running the Project

To run the project in development mode:

```bash
npm start
```

This will start a development server. By default, it runs on port 3000. You can view the project in your browser.

## Building the Project

To build the project for production:

```bash
npm build
```

This will create a `dist` folder with the bundled and optimized files.

## Customizing the Build

You can customize the build output by creating a `.env` file in the root of the project.

### Output Filename

To change the name of the output file, set the `OUTPUT_FILE_NAME` variable in your `.env` file.

**.env**
```
OUTPUT_FILE_NAME=my-custom-filename.js
```

If this variable is not set, the output file will default to `dist/main.min.js`.

### Development Server Port

You can also change the development server port by setting the `PORT` variable in your `.env` file.

**.env**
```
PORT=8080
```

If this variable is not set, the port will default to `3000`.

### CSS Output

You can control whether CSS is bundled into the JavaScript file or output as a separate file by setting the `SEPARATE_CSS` variable in your `.env` file.

**.env**
```
SEPARATE_CSS=true
```

- `true`: CSS is extracted to a separate file (e.g., `main.css`).
- `false` (default): CSS is injected into the DOM via JavaScript (using `style-loader`).

## Project Structure

- `src/` - Your JavaScript source files
- `styles/` - CSS files
- `scripts/` - Build scripts (including Web Worker transformation)
- `index.html` - Main HTML file
- `index.js` - Main JavaScript entry point
- `index.css` - Main CSS file
- `webpack.config.js` - Webpack configuration

## Webpack Build Configuration

### Features

The project uses Webpack with the following features configured:

#### Module Processing

- **CSS Processing Pipeline**
  - `style-loader` - Injects CSS into the DOM
  - `css-loader` - Resolves CSS imports and URLs
  - `postcss-loader` with cssnano - Minifies and optimizes CSS
  - Source maps enabled in development mode
  - Automatic comment removal in production builds

- **JavaScript Processing**
  - `swc-loader` - Fast JavaScript transpilation
  - Custom `transform-workers.js` loader - Transforms web worker imports
  - Dynamic imports forced to eager mode for web worker compatibility
  - Source maps enabled in development mode

#### Web Workers

The build system includes special handling for web workers:

- Custom loader (`scripts/transform-workers.js`) transforms worker imports
- Dynamic imports are eagerly evaluated for worker compatibility
- Workers are properly bundled and can be imported in your code

#### Assets Directory

The `assets/` folder receives special treatment:

- **Development Server**: Assets are served from the root path (`/`) if the directory exists and contains files
- **Production Build**: Assets are copied to the dist root (not in a subdirectory) via `CopyWebpackPlugin`
- **Conditional Loading**: Assets are only processed if the directory exists and has files

Place any static files (images, fonts, etc.) in the `assets/` directory and they will be accessible from the root path in both dev and production.

#### Optimization

- `splitChunks: false` - Bundles everything into a single file
- `runtimeChunk: false` - No separate runtime chunk
- `clean: true` - Automatically cleans the dist directory before each build

#### Development Server

- Serves static files from project root
- Conditionally serves assets directory
- Gzip compression enabled
- Cache-Control headers set to `no-store` for development
- Configurable port via environment variable

#### Environment Configuration

- `.env` file support via dotenv
- `OUTPUT_FILE_NAME` - Customize output filename (default: `main.min.js`)
- `PORT` - Configure dev server port (default: `3000`)
- `SEPARATE_CSS` - Control CSS extraction (default: `false`)
- `NODE_ENV` - Set to `production` for production builds

## Technologies

- **Webpack** - Fast bundler for development and production
- **dataroom-js** - Custom HTML elements framework
- **Web Workers** - For parallel processing
- **PostCSS** - CSS processing with cssnano optimization
- **SWC** - Fast JavaScript/TypeScript compiler

## Publishing to npm

This project is configured for publishing to npm. Follow these steps to publish:

### Before First Publish

1. **Update package metadata** in `package.json`:
   - Set the package `name` (must be unique on npm)
   - Update `author` with your name and email
   - Update `repository`, `bugs`, and `homepage` URLs with your actual repository
   - Set the initial `version` (recommend starting with `0.1.0`)

2. **Verify the package contents**:
   ```bash
   npm pack --dry-run
   ```
   This shows what files will be included in the package.

3. **Test the build**:
   ```bash
   npm run build
   ```
   Ensure the `dist/` directory is created successfully.

### Publishing

1. **Login to npm** (first time only):
   ```bash
   npm login
   ```

2. **Publish the package**:
   ```bash
   npm publish
   ```
   
   The `prepublishOnly` script will automatically run the build before publishing.

### Updating the Package

1. **Update the version** using npm's version command:
   ```bash
   npm version patch  # For bug fixes (1.0.0 -> 1.0.1)
   npm version minor  # For new features (1.0.0 -> 1.1.0)
   npm version major  # For breaking changes (1.0.0 -> 2.0.0)
   ```

2. **Publish the update**:
   ```bash
   npm publish
   ```

### What Gets Published

The package includes:
- `dist/` - Built production files
- `src/` - Source JavaScript files
- `styles/` - CSS files
- `index.js`, `index.css`, `index.html` - Entry files
- `package.json` and related metadata

Development files (webpack config, build scripts, tests, etc.) are excluded via `.npmignore`.
# crop-and-mask
