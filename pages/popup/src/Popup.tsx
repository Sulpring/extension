import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const Popup = () => {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(true);
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';

  useEffect(() => {
    // 초기 상태 로드
    chrome.storage.local.get(['screenReaderEnabled'], result => {
      setIsScreenReaderEnabled(result.screenReaderEnabled ?? true);
    });
  }, []);

  const toggleScreenReader = () => {
    const newState = !isScreenReaderEnabled;
    setIsScreenReaderEnabled(newState);
    chrome.storage.local.set({ screenReaderEnabled: newState });
    // content script에 상태 변경 알림
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_SCREEN_READER',
          enabled: newState,
        });
      }
    });
  };

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
      return;
    }
  };

  return (
    <div className={`App ${isLight ? 'bg-slate-50' : 'bg-gray-800'}`}>
      <header className={`App-header ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
        <button
          className={
            'w-[300px] h-[300px] font-bold text-5xl mt-4 py-1 px-4 rounded shadow hover:scale-105 break-keep ' +
            (isScreenReaderEnabled ? 'bg-blue-200 text-black' : 'bg-gray-700 text-white')
          }
          onClick={toggleScreenReader}>
          {isScreenReaderEnabled ? '스크린 리더 비활성화' : '스크린 리더 활성화'}
        </button>
        <div className="invisible">
          <label>
            <input type="checkbox" checked={isScreenReaderEnabled} onChange={toggleScreenReader} />
            스크린 리더 활성화
          </label>
        </div>
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
