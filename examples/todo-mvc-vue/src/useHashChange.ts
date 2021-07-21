import { onMounted, onUnmounted } from 'vue';

export function useHashChange(onHashChange) {
  onMounted(() => {
    window.addEventListener('hashchange', onHashChange);
  });
  onUnmounted(() => {
    window.removeEventListener('hashchange', onHashChange);
  });
}
