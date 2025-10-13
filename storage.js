// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBNJqosTCgP6JUaYRD5YeA_Q5oUFkZdYKc",
  authDomain: "weedtrackerv56pilot.firebaseapp.com",
  projectId: "weedtrackerv56pilot",
  storageBucket: "weedtrackerv56pilot.firebasestorage.app",
  messagingSenderId: "435437648943",
  appId: "1:435437648943:web:42237c87f1605c30a95ada",
  measurementId: "G-EBMXL90MR5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
