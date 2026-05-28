const socket = io()

///html objects
const pinBtn = document.getElementById('pin-button');
const strBtn = document.getElementById('start-button');
const playerlist = document.getElementById('player-list');
const questionText = document.getElementById('question-text');
const optionButtons = document.querySelectorAll('.option');
const leaderboardList = document.getElementById('leaderboard-list');
const PinArea = document.getElementById('pin-area');
const TimerDisplay = document.getElementById('timer-display');
const answeredPlayerList = document.getElementById('ans-player-list');

const firstScreen = document.querySelector('.first');
const secondScreen = document.querySelector('.second');
const thirdScreen = document.querySelector('.third');
const fourthScreen = document.querySelector('.fourth');
const fifthScreen = document.querySelector('.fifth');
const sixthScreen = document.querySelector('.sixth');



///variables
const findPin = new URLSearchParams(window.location.search);
const roomPin = findPin.get('pin');
let quizTemplates = [];
let roundEnded = false;
let playerAval = false;
let currentIndex = 0;
let leaderboardDuration = 3000; 
let loadingDuration = 3000;
let questionLoaderTime = 3000;



if(roomPin)
{
    socket.emit('roomCreated',
    {
        roomPin : roomPin    
    });
    
    firstScreen.classList.add('hidden');//just a placeholder so /host doesnt work directly
    secondScreen.classList.remove('hidden');
    PinArea.textContent = roomPin;
}
else
{

}

strBtn.addEventListener('click', () =>
{

    if(playerAval)
    {
        secondScreen.classList.add('hidden');
        loaderQuestion();
    }
});



///first screen of loading question
///emits question loading which in turn shows get ready on the mobile
function loaderQuestion()
{
    socket.emit('questionLoading' ,{ roomPin : roomPin });
    secondScreen.classList.add('hidden');
    thirdScreen.classList.remove('hidden');
    sixthScreen.classList.add('hidden');
    setTimeout(() => {
        mainLoop();
    },questionLoaderTime)
}

///this loads the question text on the screen
function mainLoop()
{
    roundEnded = false;
    if(currentIndex >= quizTemplates.length)
    {
        currentIndex--;
        socket.emit('gameEnded', 
        {
            roomPin : roomPin
        })
        return;
    }

    
    let questionProperties = quizTemplates[currentIndex][1];

    const currentQuestion = questionProperties.question;
    const options = questionProperties.options;

    questionText.innerText = questionProperties.question;

    optionButtons.forEach((button, index) =>
    {   
        button.innerText = questionProperties.options[index];
    });

    answeredPlayerList.innerHTML = '';
    thirdScreen.classList.add('hidden');
    fourthScreen.classList.remove('hidden');
    fifthScreen.classList.add('hidden');
    sixthScreen.classList.add('hidden');

    socket.emit('gameStarted', 
    {
        roomPin : roomPin,
        currentQuestion : questionProperties
    });

    socket.once('allAnswered', () => 
    {
        if (roundEnded) 
        {
            return;
        }
        roundEnded = true;
        loadingScreen();
    });

}

///shows the loading screen for leaderboard
///and gets the top 5 for the leaderboard
function loadingScreen()
{
    fourthScreen.classList.add('hidden');
    fifthScreen.classList.remove('hidden');

    socket.once('leaderboardUpdate', (data) =>
    {
        const leaderboard = data.leaderboard;

        leaderboardList.innerHTML = '';

        leaderboard.slice(0,5).forEach((player, index) => 
        {
            const item = document.createElement('li');
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.padding = "8px 16px";
            item.style.fontSize = "20px";
            item.style.borderBottom = "1px solid #ddd";

            item.innerHTML = `
                <span><strong>#${index + 1}</strong> ${player.nickname}</span>
                <span>${player.score} pts</span>
            `;
            leaderboardList.appendChild(item);
        });
    });

    socket.emit('questionEnded',
    {
        currentIndex : currentIndex,
        roomPin : roomPin
    });
    setTimeout(() =>
    {
        showLeaderboard()
    },loadingDuration)
}


///shows the top 5 with game over if true
function showLeaderboard()
{
    fifthScreen.classList.add('hidden');
    sixthScreen.classList.remove('hidden');

    currentIndex++;
    setTimeout(() => {
        if (currentIndex >= quizTemplates.length) {
            socket.emit('gameEnded', { roomPin : roomPin });            
            sixthScreen.innerHTML = "<h1 style='text-align:center; padding: 50px;'>Game Over!</h1>" + sixthScreen.innerHTML;
        } else {
            loaderQuestion();
        }
    }, leaderboardDuration);
}


///socket listeners


socket.on('playerJoined', (data) =>
{
    playerAval = true;
    const nickname = data.nickname;
    const playerId = data.id;

    const newListItem = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.innerText = nickname;

    const kickBtn = document.createElement('button');
    kickBtn.innerText = "Kick";
    kickBtn.classList.add("kick-btn");

    kickBtn.addEventListener('click', () =>
    {
        socket.emit('kickPlayer', playerId);
        newListItem.remove();
    });

    newListItem.appendChild(nameSpan);
    newListItem.appendChild(kickBtn);

    playerlist.appendChild(newListItem);
});

socket.on('questionLoaded', (data)=>
{
    quizTemplates = data.quizTemplates;
    console.log(quizTemplates);
});

socket.on('timerTick', (data)=>
{
    TimerDisplay.innerText = data;
});

socket.on('timeUp', (data) =>
{
    if(roundEnded)
    {
        return;
    }
    roundEnded = true;
    loadingScreen();
});

socket.on('updateAnswerList',(data)=>
{
    const nickname = data.nickname;
    const newListItem  = document.createElement('li');

    newListItem.innerText = nickname;

    answeredPlayerList.appendChild(newListItem);
});