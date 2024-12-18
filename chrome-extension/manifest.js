import fs from 'node:fs';
import deepmerge from 'deepmerge';

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));

const isFirefox = process.env.__FIREFOX__ === 'true';

const sidePanelConfig = {
  side_panel: {
    default_path: 'side-panel/index.html',
  },
  permissions: ['sidePanel'],
};

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = deepmerge(
  {
    manifest_version: 3,
    default_locale: 'en',
    /**
     * if you want to support multiple languages, you can use the following reference
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
     */
    name: '__MSG_extensionName__',
    version: packageJson.version,
    description: '__MSG_extensionDescription__',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'scripting', 'tabs', 'notifications'],
    options_page: 'options/index.html',
    background: {
      service_worker: 'background.iife.js',
      type: 'module',
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' https://devcjs.co.kr https://* http://* data: blob:; img-src 'self' https://* http://* data: blob:;",
    },
    action: {
      default_popup: 'popup/index.html',
      default_icon: 'icon-34.png',
    },
    icons: {
      16: 'favicon-16x16.png',
      32: 'favicon-32x32.png',
      48: 'favicon-96x96.png',
      128: 'favicon-96x96.png',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['content/index.iife.js'],
      },
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['content-ui/index.iife.js'],
      },
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['refresh.js'], // for public's HMR(refresh) support
        css: ['content.css'], // public folder
      },
    ],
    devtools_page: 'devtools/index.html',
    web_accessible_resources: [
      {
        resources: ['*.js', '*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
        matches: ['*://*/*'],
      },
    ],
  },
  !isFirefox && sidePanelConfig,
);

export default manifest;
