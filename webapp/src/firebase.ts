import firebase from 'firebase/app';// rollup bundle issue with ESM import
import 'firebase/auth';

var firebaseConfig = {
      apiKey: "AIzaSyCTjnP1OP9ADtOgSUTOwxmNJDdN5dITTm0",
    authDomain: "ptone-serverless.firebaseapp.com",
    databaseURL: "https://ptone-serverless.firebaseio.com",
    projectId: "ptone-serverless",
    storageBucket: "ptone-serverless.appspot.com",
    messagingSenderId: "255222064158",
    appId: "1:255222064158:web:29c87c1f6c2efb8c"
};

console.log(firebase)

firebase.initializeApp(firebaseConfig);

export const fireAuth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();

export function signIn() {
  fireAuth.signInWithPopup(googleProvider);
}