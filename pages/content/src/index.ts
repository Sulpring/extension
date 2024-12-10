import { toggleTheme } from '@src/toggleTheme';

console.log('content script loaded');

let isFirstClick = true;

async function toBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchNewAltTexts(images: { src: string; currentAlt: string }[]) {
  try {
    const imagesWithBase64 = await Promise.all(
      images.map(async img => ({
        img_url: img.src,
        img_file: await toBase64(img.src),
      })),
    );

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

  const imageData = images.map(img => ({
    src: img.src,
    currentAlt: img.alt,
  }));
  console.log(imageData.length);

  const newAltTexts = await fetchNewAltTexts(imageData);

  if (newAltTexts) {
    images.forEach((img, index) => {
      if (newAltTexts[index]) {
        img.alt = newAltTexts[index];
      }
    });
  }
}

// 페이지 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', updateImageAlts);

document.addEventListener('click', e => {
  const target = e.target as HTMLElement;

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

// 페이지 로드 시 블러 필터 추가
document.addEventListener('DOMContentLoaded', addBlurEffect);

// 페이지를 떠날 때 블러 필터 제거
window.addEventListener('beforeunload', removeBlurEffect);

void toggleTheme();
