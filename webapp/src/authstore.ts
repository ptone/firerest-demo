import { writable } from 'svelte/store';


import { fireAuth, googleProvider } from './firebase';
import { authState } from 'rxfire/auth';
// const uu: firebase.User = new(firebase.User)
export const user  = writable(<firebase.User>{});
const unsubscribe = authState(fireAuth).subscribe(u => {
  console.log(u);
  user.set(u);
});