import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { useState, type ComponentPropsWithoutRef } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

type Image = {
  imageUrl: string;
  imageAlt: string;
};

const Popup = () => {
  const [imageUrls, setImageUrls] = useState<Image[]>([]);
  const [isReading, setIsReading] = useState(false);
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';

  const stopReading = () => {
    speechSynthesis.cancel();
    setIsReading(false);
  };

  const startReading = () => {
    setIsReading(true);
    const altTexts = Array.from(imageUrls)

      .map(img => img.imageAlt || '대체 텍스트가 없는 이미지입니다.');
    console.log(altTexts);

    altTexts.forEach((text, index) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      if (index === altTexts.length - 1) {
        utterance.onend = () => setIsReading(false);
      }
      speechSynthesis.speak(utterance);
    });
  };

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
      return;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => {
          const images = document.getElementsByTagName('img');
          return Array.from(images)
            .filter(img => img.src !== '')
            .map(img => ({
              imageUrl: img.src,
              imageAlt: img.alt,
            }));
        },
      });
      setImageUrls(results[0].result ?? []);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Cannot access a chrome:// URL')) {
        chrome.notifications.create('inject-error', notificationOptions);
      }
    }
  };

  return (
    <div className={`App ${isLight ? 'bg-slate-50' : 'bg-gray-800'}`}>
      <header className={`App-header ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
        <button
          className={
            'font-bold mt-4 py-1 px-4 rounded shadow hover:scale-105 ' +
            (isLight ? 'bg-blue-200 text-black' : 'bg-gray-700 text-white')
          }
          onClick={injectContentScript}>
          스크랩 이미지 가져오기
        </button>

        <div className="mt-4 max-h-60 overflow-y-auto">
          {imageUrls.map((img, index) => (
            <div key={index} className="mb-2 text-sm">
              <img src={img.imageUrl} alt={img.imageAlt} className="mr-2 inline-block size-16 object-cover" />
              <span className="break-all">{img.imageAlt}</span>
            </div>
          ))}
        </div>

        {imageUrls.length > 0 && (
          <button
            className={
              'font-bold mt-4 py-1 px-4 rounded shadow hover:scale-105 ' +
              (isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white')
            }
            onClick={isReading ? stopReading : startReading}>
            {isReading ? '읽기 중지' : '이미지 설명 읽기'}
          </button>
        )}

        <ToggleButton>Toggle theme</ToggleButton>
      </header>
    </div>
  );
};
const ToggleButton = (props: ComponentPropsWithoutRef<'button'>) => {
  const theme = useStorage(exampleThemeStorage);
  return (
    <button
      className={
        props.className +
        ' ' +
        'font-bold mt-4 py-1 px-4 rounded shadow hover:scale-105 ' +
        (theme === 'light' ? 'bg-white text-black shadow-black' : 'bg-black text-white')
      }
      onClick={exampleThemeStorage.toggle}>
      {props.children}
    </button>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
