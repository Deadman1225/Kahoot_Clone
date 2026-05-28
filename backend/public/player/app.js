const socket = io();

const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const pinInput = document.getElementById('pin-input');
const nicknameInput = document.getElementById('nickname-input');
const joinBtn = document.getElementById('join-btn');
const welcomeMessage = document.getElementById('welcome-message');
const optionBtn = document.getElementById('option-cards')
const questionScreen = document.getElementById('question-screen');
const answerScreen = document.getElementById('answer-screen');

joinBtn.addEventListener('click', () => {
    const roomPin = pinInput.value.trim();
    const nickname = nicknameInput.value.trim();

    if (roomPin === '' || nickname === '') {
        alert("Please enter both a PIN and a Nickname!");
        return;
    }

    socket.emit('joinRoom', {
        roomPin: roomPin,
        nickname: nickname
    });
});

optionBtn.addEventListener('click', () => {
    //add an emitter for the button clicked 


    questionScreen.classList.add('hidden');
    answerScreen.classList.remove('hidden');

});


socket.on('joinedSuccess', (data) => {
    lobbyScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    console.log(data.message);
});

socket.on('gameStarted', (data) =>{
    waitingScreen.classList.add('hidden');
    questionScreen.classList.remove('hidden');
});

socket.on('joinError', (data) =>
{
    alert(data.message);
});