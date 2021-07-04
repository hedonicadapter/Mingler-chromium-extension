// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
var firebaseConfig = {
  apiKey: 'AIzaSyDvwcnNKlwxZlGi3OGz_4BCVaVECRuj2kA',
  authDomain: 'sharehub-2fdfb.firebaseapp.com',
  databaseURL:
    'https://sharehub-2fdfb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'sharehub-2fdfb',
  storageBucket: 'sharehub-2fdfb.appspot.com',
  messagingSenderId: '542998666825',
  appId: '1:542998666825:web:0ea6f84fea704beb2e2998',
  measurementId: 'G-MSS4CM3SNF',
};
// Initialize Firebase
let app = firebase.initializeApp(firebaseConfig);
console.log(app);

//database access variable
const db = app.firestore();
