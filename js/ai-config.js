// AI 피드백 연결 설정 (교사가 한 번만 채움)
// proxy/claude-proxy-worker.js를 Cloudflare Workers에 배포한 뒤 그 주소를 아래에 넣고 배포하면,
// 모든 학생 기기에서 API 키 없이 AI 평가를 쓸 수 있습니다. 비워 두면 각 기기의 [AI 설정]에서 입력합니다.
window.AI_CONFIG = {
  proxyUrl: '',
};
