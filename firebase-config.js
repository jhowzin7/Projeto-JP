// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBIGUKXEwWiAk88AOjJX0mCZ-iW8zFTW80",
  authDomain: "kanban-jp.firebaseapp.com",
  projectId: "kanban-jp",
  storageBucket: "kanban-jp.firebasestorage.app",
  messagingSenderId: "478197845825",
  appId: "1:478197845825:web:9a6da51a9909cf22645bc0",
  measurementId: "G-SH2FHZN8H4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);