const express = require('express')
const http = require('http')
const User = require('./models/User')
const Session = require('./models/Session')
const { Server } = require('socket.io')
const mongoose = require('mongoose')
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to Database"))
    .catch((err) => console.log("Error in database"));
    
app.use(express.static('public'));


app.get('/deck', (req,res) =>
{
    res.sendFile(__dirname + '/public/host/deck.html');
});

app.get('/host', (req,res) =>
{
    res.sendFile(__dirname + '/public/host/host.html');
});

const socketToRoom = {};
const generatedRooms = {};
const activeRooms = {};
const socketToNickname = {};
let imageFile = null;

io.on('connection', socket =>
{   
    console.log(`Socket connected: ${socket.id}`);
    
    socket.on('disconnect', () => 
    {
        console.log(`Socket disconnected : ${socket.id}`);

        const roomPin = socketToRoom[socket.id];
        const nickname = socketToNickname[socket.id];

        if(roomPin && activeRooms[roomPin] && activeRooms[roomPin].answeredPlayers)
        {
            activeRooms[roomPin].totalPlayers = Math.max(0,activeRooms[roomPin].totalPlayers - 1);
            activeRooms[roomPin].answeredPlayers.delete(socket.id);
            if(activeRooms[roomPin].playerPoints)
            {
                delete activeRooms[roomPin].playerPoints[socket.id];
            }
            if (nickname && activeRooms[roomPin].nickname) 
            {
                activeRooms[roomPin].nickname.delete(nickname);
            }

            delete socketToNickname[socket.id];
            delete socketToRoom[socket.id];
        }
    });

    socket.on('createPendingQuiz',(data,callback)=>
    {
        const roomPin = String(Math.floor(Math.random() * 100000));

        generatedRooms[roomPin] = data;

        callback({roomPin : roomPin});

    });

    socket.on('roomCreated', async(data) =>
    {
        const roomPin = data.roomPin;
        const quizTemplates = generatedRooms[roomPin];

        activeRooms[roomPin] = 
        {
            scores : {},
            totalPlayers : 0,
            answeredPlayers : new Set(),
            playerPoints : {},
            currentQuestion : null,
            startTime : null,
            nickname : new Set(),
            hostSocketId : socket.id,
            timeLeft : null,
            timerInterval : null
        }
        try
        {
            const newSession = await Session.create
            ({
                roomPin : roomPin,
                hostSocketId : socket.id,
            });
            socket.join(roomPin);
            socket.emit('questionLoaded', {quizTemplates : quizTemplates});

            delete generatedRooms[roomPin];
        }
        catch(error)
        {
            console.log("Error happend in roomCreated" ,error);
        }
    });

    socket.on('joinRoom', async(data) =>
    {
        const nickname = data.nickname;
        const roomPin = data.roomPin;
        try
        {
            const activeSession = activeRooms[roomPin];

            if(!activeSession)
            {
                return socket.emit('pinError');
            }
            if(activeSession.currentQuestion !== null || activeSession.startTime !== null) 
            {
                return socket.emit('startedError'); 
            }
                    
            let nicknameIsTaken = activeRooms[roomPin].nickname.has(nickname);
            
            if(nicknameIsTaken)
            {
                return socket.emit('nicknameError');
            }

            const newUser = await User.create
            ({
                nickname  :nickname,
                socketId : socket.id,
                roomPin : roomPin
            })
            
            activeRooms[roomPin].nickname.add(nickname);
            activeRooms[roomPin].scores[socket.id] = 0;
            activeRooms[roomPin].totalPlayers++;
            socketToRoom[socket.id] = roomPin;
            socketToNickname[socket.id] = nickname;

            socket.join(roomPin);
            
            socket.emit('joinedSuccess');

            io.to(activeSession.hostSocketId).emit('playerJoined' , 
            {
                nickname : nickname,
                id : socket.id
            });
        }
        catch(error)
        {
            console.log("Error happend in joinRoom" ,error);
        }
    });


    socket.on('questionLoading',(data) =>
    {
        io.to(data.roomPin).emit('optionLoading', data);
    });
    socket.on('gameStarted', (data) => 
    {
        activeRooms[data.roomPin].currentQuestion = data.currentQuestion;
        activeRooms[data.roomPin].startTime = Date.now();
        activeRooms[data.roomPin].timeLeft = data.currentQuestion.timer;

        io.to(data.roomPin).emit('gameStarted', data);

        if (activeRooms[data.roomPin].timerInterval) 
        {
            clearInterval(activeRooms[data.roomPin].timerInterval);
        }
        activeRooms[data.roomPin].timerInterval = setInterval(() =>
        {
            activeRooms[data.roomPin].timeLeft--;
            io.to(data.roomPin).emit('timerTick', activeRooms[data.roomPin].timeLeft);
            
            if (activeRooms[data.roomPin].timeLeft <= 0) 
            {
                clearInterval(activeRooms[data.roomPin].timerInterval);
                io.to(data.roomPin).emit('timeUp'); 
            }
        },1000);
    });

    socket.on('submitAnswer', async(data) =>
    {   
        const roomPin = data.roomPin;
        data.playerSocketId = socket.id;        

        const activeSession = await Session.findOne({ roomPin: data.roomPin });

        let chosenColor = data.color;
        let chosenOption;
        const currentQ = activeRooms[roomPin].currentQuestion;
        
        switch(chosenColor)
        {
            case 'Red':
                chosenOption = 0
                break;
            case 'Blue':
                chosenOption = 1
                break;
            case 'Yellow':
                chosenOption = 2
                break;
            case 'Green':
                chosenOption = 3
                break;
        }

        io.to(socket.id).emit('answerSubmitted');
        const isCorrect = (chosenOption == currentQ.correctAnswer);
        let pointsEarned = 0;

        if(isCorrect)
        {
            const timeElapsed = (Date.now() - activeRooms[roomPin].startTime) / 1000;
            const questionDuration = currentQ.timer;

            pointsEarned = Math.floor(1000 * (1 - (timeElapsed / (questionDuration * 2))));
        }

        activeRooms[roomPin].playerPoints[data.playerSocketId] =
        {
            isCorrect : isCorrect,
            points : pointsEarned
        };

        activeRooms[roomPin].answeredPlayers.add(socket.id);

        io.to(activeSession.hostSocketId).emit('updateAnswerList', {nickname : socketToNickname[socket.id]});
        if(activeRooms[roomPin].answeredPlayers.size == activeRooms[roomPin].totalPlayers)
        {
            clearInterval(activeRooms[roomPin].timerInterval);
            io.to(activeSession.hostSocketId).emit('allAnswered');
        }
    });

    socket.on('questionEnded', async(data)=>
    {
        const roomPin = data.roomPin;
        const currentRoomOptions = activeRooms[roomPin].playerPoints;

        for(const id in activeRooms[roomPin].scores)
        {
            const playerResult = currentRoomOptions[id];

            if(!playerResult)
            {
                io.to(id).emit('wrongAnswer',{total: activeRooms[roomPin].scores[id] || 0});
                continue;
            }

            if(playerResult.isCorrect)
            {
                activeRooms[roomPin].scores[id] += playerResult.points;
                io.to(id).emit('correctAnswer',{points: playerResult.points,total: activeRooms[roomPin].scores[id]});
            }
            else
            {
                io.to(id).emit('wrongAnswer',{total: activeRooms[roomPin].scores[id]});
            }
        }

        const scoreboard = [];
        for (const id in activeRooms[roomPin].scores) 
        {
            const userDoc = await User.findOne({ socketId: id });
            scoreboard.push
            ({
                nickname: userDoc.nickname,
                score: activeRooms[roomPin].scores[id],
                id : id
            });
        }

        scoreboard.sort((a, b) => b.score - a.score);

        io.to(roomPin).emit('leaderboardUpdate', { leaderboard: scoreboard });

        for(let i = 1; i <= scoreboard.length; i++)
        {
            io.to(scoreboard[i - 1].id).emit('positionUpdate', { i : i });
        }

        activeRooms[roomPin].playerPoints = {};    
        activeRooms[roomPin].answeredPlayers.clear();
    });

    socket.on('gameEnded', (data)=>
    {
        const roomPin = data.roomPin;
        io.to(roomPin).emit('gameEnded', {roomPin : roomPin});
    });

socket.on('kickPlayer', async(Id) =>
{
    const roomPin = socketToRoom[Id];
    const nickname = socketToNickname[Id];

    if(roomPin && activeRooms[roomPin])
    {
        activeRooms[roomPin].totalPlayers = Math.max(0,activeRooms[roomPin].totalPlayers - 1);

        activeRooms[roomPin].answeredPlayers.delete(Id);

        delete activeRooms[roomPin].scores[Id];
        delete activeRooms[roomPin].playerPoints[Id];
        delete socketToRoom[Id];
    }

    if(nickname && activeRooms[roomPin].nickname)
    {
        activeRooms[roomPin].nickname.delete(nickname);
    }
    delete socketToNickname[Id];
    await User.deleteOne({ socketId : Id });

    const playerSocket = io.sockets.sockets.get(Id);

    if(playerSocket)
    {
        playerSocket.emit('kicked');
        playerSocket.disconnect(true);
    }
});

});

server.listen(3000, () =>
{
    console.log("Server running");
});
