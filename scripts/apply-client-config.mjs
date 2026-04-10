import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const configPath = path.join(rootDir, 'client.config.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing client.config.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const writeText = (relativePath, content) => fs.writeFileSync(path.join(rootDir, relativePath), content, 'utf8');

const updateClientConfigModule = () => {
  const generatedPath = path.join(rootDir, 'src', 'config', 'clientConfig.generated.ts');
  const normalizedConfig = {
    ...config,
    webAppUrl: config.webAppUrl || process.env.VITE_APP_URL || 'https://carpet-rbnd.vercel.app',
  };
  const generatedContent = `const clientConfig = ${JSON.stringify(normalizedConfig, null, 2)} as const;\n\nexport default clientConfig;\n`;
  fs.writeFileSync(generatedPath, generatedContent, 'utf8');
};

const updatePackageJson = () => {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  packageJson.description = `${config.systemName} for web, Android, and Windows desktop.`;
  packageJson.author = config.author;
  packageJson.build = packageJson.build || {};
  packageJson.build.appId = config.desktopAppId;
  packageJson.build.productName = config.desktopProductName;

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
};

const updateCapacitorConfig = () => {
  let content = readText('capacitor.config.ts');
  content = content.replace(/appId:\s*'[^']+'/, `appId: '${config.mobileAppId}'`);
  content = content.replace(/appName:\s*'[^']+'/, `appName: '${config.mobileAppName}'`);
  writeText('capacitor.config.ts', content);
};

const updateElectronMain = () => {
  let content = readText(path.join('electron', 'main.cjs'));
  content = content.replace(/const DESKTOP_APP_ID = '[^']+';/, `const DESKTOP_APP_ID = '${config.desktopAppId}';`);
  content = content.replace(/title: '[^']+',/, `title: '${config.desktopProductName}',`);
  content = content.replace(/message: 'تم تنزيل تحديث جديد لبرنامج [^']+'\./, `message: 'تم تنزيل تحديث جديد لبرنامج ${config.desktopProductName}.'`);
  writeText(path.join('electron', 'main.cjs'), content);
};

const updateIndexHtml = () => {
  let content = readText('index.html');
  content = content.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${config.metaDescription}" />`);
  content = content.replace(/<title>[^<]*<\/title>/, `<title>${config.webTitle}</title>`);
  writeText('index.html', content);
};

const updateAndroidStrings = () => {
  let content = readText(path.join('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'));
  content = content.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${config.mobileAppName}</string>`);
  content = content.replace(/<string name="title_activity_main">[^<]*<\/string>/, `<string name="title_activity_main">${config.mobileAppName}</string>`);
  content = content.replace(/<string name="package_name">[^<]*<\/string>/, `<string name="package_name">${config.mobileAppId}</string>`);
  content = content.replace(/<string name="custom_url_scheme">[^<]*<\/string>/, `<string name="custom_url_scheme">${config.mobileAppId}</string>`);
  writeText(path.join('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'), content);
};

updatePackageJson();
updateCapacitorConfig();
updateElectronMain();
updateIndexHtml();
updateAndroidStrings();
updateClientConfigModule();

console.log(`Applied client branding for ${config.companyNameEn}`);
