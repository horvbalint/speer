export default ({ $axios, redirect, store, ...ctx }) => {
  $axios.onRequest( config => {
    config.withCredentials = true
  })
  $axios.onError( error => {
    if (error.response && error.response.status == 401) {
      store.dispatch('logout')
      redirect('/login')
    }
  })
}