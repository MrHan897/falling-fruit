// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCapeQviTPJYzG9WFFHx7tGcRFyLRaly2k",
    authDomain: "falling-fruit-game.firebaseapp.com",
    projectId: "falling-fruit-game",
    storageBucket: "falling-fruit-game.firebasestorage.app",
    messagingSenderId: "894553766409",
    appId: "1:894553766409:web:6c79604f5c546eab5656d8",
    measurementId: "G-B501SRV518"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
