import Vue from 'vue';
import App from './App.vue';
import xx from '../../../lib';
Vue.use(xx);
Vue.config.productionTip = false;

new Vue({
  render: h => h(App)
}).$mount('#app');
