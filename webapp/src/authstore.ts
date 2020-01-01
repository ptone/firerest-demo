import { writable } from 'svelte/store';


import { fireAuth, googleProvider } from './firebase';
import { authState } from 'rxfire/auth';
export const user  = writable(<firebase.User>{});
user.set(null as unknown as firebase.User)
const unsubscribe = authState(fireAuth).subscribe(u => {
  // console.log(u);
  user.set(u);
});
