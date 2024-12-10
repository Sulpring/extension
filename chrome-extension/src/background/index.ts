import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_IMAGES') {
    Promise.all(
      message.images.map(async (imgUrl: string) => {
        try {
          const response = await fetch(imgUrl);
          const blob = await response.blob();
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve({
                img_url: imgUrl,
                img_file: reader.result,
              });
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('이미지 가져오기 실패:', error);
          return null;
        }
      }),
    ).then(results => {
      sendResponse(results.filter(result => result !== null));
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});

console.log('background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
