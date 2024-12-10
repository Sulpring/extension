import { toggleTheme } from '@src/toggleTheme';

console.log('content script loaded');
// 시연 시 저시력자 시연용 블러 필터 적용
//addBlurEffect();

function waitForImages(): Promise<void> {
  return new Promise(resolve => {
    let lastCount = 0;
    let stabilityCounter = 0;

    const checkImages = setInterval(() => {
      const currentCount = document.getElementsByTagName('img').length;
      console.log('현재 감지된 이미지 수:', currentCount);

      if (currentCount === lastCount) {
        stabilityCounter++;
        if (stabilityCounter >= 1) {
          clearInterval(checkImages);
          console.log('이미지 로딩 완료. 최종 이미지 수:', currentCount);
          resolve();
        }
      } else {
        stabilityCounter = 0;
      }

      lastCount = currentCount;
    }, 2000); // 2초로 증가

    // 30초 후에는 강제로 종료
    setTimeout(() => {
      clearInterval(checkImages);
      console.log('시간 초과. 현재 이미지 수로 진행:', lastCount);
      resolve();
    }, 30000);
  });
}

const observer = new MutationObserver(async mutations => {
  await waitForImages();
  updateImageAlts();
  observer.disconnect(); // 한 번만 실행하고 옵저버 중지
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

let isFirstClick = true;

async function fetchNewAltTexts(images: { src: string; currentAlt: string }[]) {
  try {
    // background script에 메시지 전송
    const imagesWithBase64 = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGES',
      images: images.map(img => img.src),
    });

    const response = await fetch('YOUR_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images: imagesWithBase64 }),
    });

    return await response.json();
  } catch (error) {
    console.error('Alt 텍스트 가져오기 실패:', error);
    return null;
  }
}
// 페이지의 모든 이미지를 스캔하고 alt 텍스트 업데이트
async function updateImageAlts() {
  const images = Array.from(document.getElementsByTagName('img'));

  const significantImages = images.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width >= 200;
  });

  const imageData = significantImages.map(img => ({
    src: img.src,
    currentAlt: img.alt,
  }));
  console.log('처리할 이미지 수:', imageData.length);

  const newAltTexts = await fetchNewAltTexts(imageData);

  if (newAltTexts) {
    images.forEach((img, index) => {
      if (newAltTexts[index]) {
        img.alt = newAltTexts[index];
      }
    });
  }
}

document.addEventListener('click', e => {
  const target = e.target as HTMLElement;
  console.log('click');

  target.style.border = '10px solid blue';

  setTimeout(() => {
    target.style.border = '';
  }, 2000);

  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement;
    const parentAnchor = img.closest('a');

    if (parentAnchor && isFirstClick) {
      e.preventDefault();
      isFirstClick = false;

      // 3초 후에 isFirstClick 초기화
      setTimeout(() => {
        isFirstClick = true;
      }, 3000);
    }

    const altText = img.alt || '대체 텍스트가 없는 이미지입니다.';
    const utterance = new SpeechSynthesisUtterance(altText);
    utterance.lang = 'ko-KR';

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } else {
    // 이미지가 아닌 경우 텍스트 읽기
    const textContent = target.textContent?.trim();
    if (textContent) {
      const utterance = new SpeechSynthesisUtterance(textContent);
      utterance.lang = 'ko-KR';

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } else {
      speechSynthesis.speak(new SpeechSynthesisUtterance('텍스트가 없습니다.'));
    }
  }
});

// 블러 필터를 추가하는 함수
function addBlurEffect() {
  const style = document.createElement('style');
  style.id = 'blur-effect-style';
  style.textContent = `
    body {
      filter: blur(5px);
    }
  `;
  document.head.appendChild(style);
}

// 블러 필터를 제거하는 함수
function removeBlurEffect() {
  const style = document.getElementById('blur-effect-style');
  if (style) {
    style.remove();
  }
}
void toggleTheme();
