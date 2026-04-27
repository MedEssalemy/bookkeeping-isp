import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// Order matters: Pinia before Router
// The router guard reads from the auth store, so Pinia must be installed first.
app.use(createPinia())
app.use(router)

app.mount('#app')
