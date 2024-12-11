console.log('content script loaded');
// 시연 시 저시력자 시연용 블러 필터 적용
//addBlurEffect();

let isScreenReaderEnabled = true;
let isProcessingImages = false;

// 초기 상태 로드
chrome.storage.local.get(['screenReaderEnabled'], result => {
  isScreenReaderEnabled = result.screenReaderEnabled ?? true;
});

// 메시지 리스너 추가
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'TOGGLE_SCREEN_READER') {
    isScreenReaderEnabled = message.enabled;
  }
});

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
  if (isProcessingImages) {
    console.log('이미지 처리 중... 새로운 요청 무시됨');
    return null;
  }

  try {
    isProcessingImages = true;
    console.log('이미지 처리 시작');

    // 모든 이미지를 한꺼번에 처리
    const imagesWithBase64 = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGES',
      images: images.map(img => img.src),
    });
    console.log(imagesWithBase64);

    const response = await fetch('https://devcjs.co.kr/explain/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imgs: imagesWithBase64 }),
    });

    const results = await response.json();
    return results;
  } catch (error) {
    console.error('Alt 텍스트 가져오기 실패:', error);
    return null;
  } finally {
    isProcessingImages = false;
    console.log('이미지 처리 완료');
  }
}
// 페이지의 모든 이미지를 스캔하고 alt 텍스트 업데이트
async function updateImageAlts() {
  if (isProcessingImages) {
    console.log('이미지 처리 중... updateImageAlts 무시됨');
    return;
  }

  const images = Array.from(document.getElementsByTagName('img'));
  const significantImages = images.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width >= 200 && img.src !== '';
  });

  // 처리 전 임시 표시 추가
  significantImages.forEach(img => {
    if (!img.alt || img.alt.trim() === '') {
      img.alt = '이미지 설명 생성 중...';
      // 처리 중임을 시각적으로 표시
      img.classList.add('processing-alt');

      // 처리 중 표시 스타일 추가
      const processingStyle = document.createElement('style');
      processingStyle.textContent = `
        .processing-alt {
          outline: 2px dashed #FFB800;
          outline-offset: 2px;
          position: relative;
        }
        .processing-alt::after {
          content: '🔄 이미지 분석 중...';
          position: absolute;
          top: 0;
          left: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 4px;
        }
      `;
      document.head.appendChild(processingStyle);
    }
  });

  const imageData = significantImages.map(img => ({
    src: img.src,
    currentAlt: img.alt,
  }));

  console.log('처리할 이미지 수:', imageData.length);
  if (imageData.length === 0) {
    console.log('처리할 이미지가 없음');
    return;
  }

  const response = await fetchNewAltTexts(imageData);

  if (response && response.explain_list) {
    significantImages.forEach((img, index) => {
      const explanation = response.explain_list[index];
      if (explanation) {
        // human_explain이 있으면 우선 사용, 없으면 ai_explain 사용
        const altText = explanation.ai_explain || explanation.human_explain;
        if (altText) {
          img.alt = altText;
          img.classList.remove('processing-alt');
        }
      }
    });
    console.log('이미지 alt 텍스트 업데이트 완료');
  } else {
    // 처리 실패 시 표시 업데이트
    significantImages.forEach(img => {
      if (img.classList.contains('processing-alt')) {
        img.alt = '이미지 설명을 생성하지 못했습니다.';
        img.classList.remove('processing-alt');
      }
    });
    console.log('이미지 alt 텍스트 업데이트 실패');
  }
}

// 포커스 가능한 요소들을 가져오는 함수
function getFocusableElements(): HTMLElement[] {
  // 의미 있는 요소들의 선택자
  const selectors = `
    a, button, input, select, textarea, img,
    p, h1, h2, h3, h4, h5, h6, li, span:not(:empty)
  `;

  const allElements = Array.from(document.querySelectorAll(selectors)) as HTMLElement[];

  return allElements.filter(element => {
    // 요소가 화면에 보이는지 확인
    const isVisible = (element: HTMLElement): boolean => {
      const style = window.getComputedStyle(element);
      return !!(
        element.offsetWidth &&
        element.offsetHeight &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        // 요소가 화면 영역 내에 있는지 확인
        element.getBoundingClientRect().height > 0
      );
    };

    // 의미 있는 컨텐츠가 있는지 확인
    const hasContent = (element: HTMLElement): boolean => {
      if (element.tagName === 'IMG') {
        return true;
      }

      // 직접적인 텍스트 노드 확인
      const hasDirectText = Array.from(element.childNodes).some(
        node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim().length > 0,
      );

      // 입력 요소인 경우
      if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
        return true;
      }

      return hasDirectText || element.innerText.trim().length > 0;
    };

    // 부모 요소 중에 이미 선택된 의미 있는 텍스트가 있는지 확인
    const hasSelectedParentWithSameText = (element: HTMLElement): boolean => {
      let parent = element.parentElement;
      while (parent) {
        if (
          allElements.includes(parent) &&
          parent.innerText.trim() === element.innerText.trim() &&
          !hasContent(element)
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    return isVisible(element) && hasContent(element) && !hasSelectedParentWithSameText(element);
  });
}

// 요소들의 tabindex 설정
function setupTabIndexes() {
  const elements = getFocusableElements();
  elements.forEach(element => {
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1'); // 키보드 탐색만 가능하도록 설정
    }
  });
}

// 초기 설정 및 동적 변경 감지
document.addEventListener('DOMContentLoaded', setupTabIndexes);

// DOM 변경 감지하여 새로운 요소에 대해 tabindex 설정
const newObserver = new MutationObserver(() => {
  setupTabIndexes();
});

newObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// 현재 포커스된 요소의 인덱스를 찾는 함수
function getCurrentFocusIndex(elements: HTMLElement[]): number {
  const currentElement = document.activeElement as HTMLElement;
  return elements.indexOf(currentElement);
}

// 포커스된 요소의 텍스트를 읽는 함수
function readElement(element: HTMLElement) {
  if (!isScreenReaderEnabled) return;

  document.querySelectorAll('.screen-reader-focus').forEach(el => {
    el.classList.remove('screen-reader-focus');
  });

  element.classList.add('screen-reader-focus');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  let content = '';
  if (element.tagName === 'IMG') {
    content = (element as HTMLImageElement).alt || '대체 텍스트가 없는 이미지입니다.';
  } else if (element instanceof HTMLInputElement) {
    content = element.value || element.placeholder || '입력 필드';
  } else {
    content = element.innerText.trim() || '텍스트가 없습니다.';
  }

  const elementType = getElementType(element);
  const positionInfo = `${elementType}: `;
  const utterance = new SpeechSynthesisUtterance(positionInfo + content);
  utterance.lang = 'ko-KR';

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// 요소 타입을 한글로 반환하는 헬퍼 함수
function getElementType(element: HTMLElement): string {
  const tagMap: { [key: string]: string } = {
    A: '링크',
    BUTTON: '버튼',
    INPUT: '입력 필드',
    IMG: '이미지',
    P: '문단',
    H1: '제목 1',
    H2: '제목 2',
    H3: '제목 3',
    LI: '목록 항목',
    TD: '테이블 셀',
    TH: '테이블 헤더',
    DIV: '영역',
    SPAN: '텍스트',
  };

  return tagMap[element.tagName] || element.tagName.toLowerCase();
}

// 키보드 이벤트 리스너 수정
document.addEventListener('keydown', e => {
  if (!isScreenReaderEnabled) return;

  const focusableElements = getFocusableElements();
  const currentIndex = getCurrentFocusIndex(focusableElements);

  let nextIndex = -1;

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= focusableElements.length) {
        nextIndex = 0; // 처음으로 순환
      }
      break;

    case 'ArrowLeft':
      e.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = focusableElements.length - 1; // 마지막으로 순환
      }
      break;

    case 'Enter':
      // Enter 키로 선택된 요소 활성화
      if (document.activeElement instanceof HTMLElement) {
        e.preventDefault();
        document.activeElement.click();
      }
      return;
  }

  if (nextIndex !== -1) {
    const nextElement = focusableElements[nextIndex];
    nextElement.focus();
    readElement(nextElement);
  }
});

// 시각적 포커스 표시를 위한 스타일 동적 추가
const style = document.createElement('style');
style.textContent = `
  .screen-reader-focus {
    outline: 10px solid #2196F3 !important;
    outline-offset: 2px;
    box-shadow: 0 0 8px rgba(33, 150, 243, 0.6);
    transition: outline 0.2s ease-in-out;
  }
`;
document.head.appendChild(style);

document.addEventListener('click', e => {
  if (!isScreenReaderEnabled) return;

  const target = e.target as HTMLElement;
  readElement(target);

  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement;
    const parentAnchor = img.closest('a');

    if (parentAnchor && isFirstClick) {
      e.preventDefault();
      isFirstClick = false;

      setTimeout(() => {
        isFirstClick = true;
      }, 3000);
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
